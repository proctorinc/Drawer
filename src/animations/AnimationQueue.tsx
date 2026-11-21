/**
 * The animation queue: celebrations take turns instead of piling up.
 *
 * - The stage plays one full-attention animation at a time, first in first
 *   out. An item with `ready` holds the line until that promise settles (or
 *   skips itself after READY_TIMEOUT_MS); anything queued behind it waits.
 * - XP waits its turn in the stage's line, so it always fills after what was
 *   earned ahead of it, then pops down at the top. Cards earned while XP is
 *   still waiting cut in ahead of it, and more XP merges into the waiting
 *   popdown, so a burst of activity plays as: every card, one XP fill, then
 *   a rank-up (which also waits for the bar, since that's what carries you).
 * - The ticker plays small top pings one after another in its own lane. They
 *   hold while a card is on stage or waiting, so they show with the XP fill
 *   instead of over a celebration.
 *
 * The stage and ticker render wherever the provider sits, so it must sit
 * inside the router (stage pieces use Link/useNavigate) and the query client.
 */
import {
  Component,
  Suspense,
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { TickerComponent, preloadStage, stageRegistry } from './registry';
import type { ErrorInfo, FC, ReactNode } from 'react';
import type {
  StageComponent,
  StageItem,
  StageKind,
  StagePayloads,
  StageStep,
  TickerItem,
} from './types';

/** How long a stage item may hold the line waiting on its `ready` promise */
export const READY_TIMEOUT_MS = 20_000;

/** How a queued stage item ended */
export type StageOutcome = 'played' | 'skipped' | 'dismissed';

type Listener = () => void;

type StageEntry = {
  item: StageItem;
  /** waiting in line → preparing (at the front, awaiting `ready`) → playing */
  status: 'waiting' | 'preparing' | 'playing';
  settle: (outcome: StageOutcome) => void;
  done: Promise<StageOutcome>;
};

export type StageSnapshot = {
  /** What's on stage right now, if anything */
  playing: StageItem | null;
  /** Its place in its group, when it's one of several */
  step?: StageStep;
  /** Something is playing, or the front item is waiting on its `ready` */
  busy: boolean;
  /** How many are queued behind */
  waiting: number;
  /** Cards (anything but XP) playing or waiting; pings hold while there are any */
  cards: number;
};

/** Earned cards go ahead of XP and rank-ups that are still waiting */
const CUTS_IN: ReadonlySet<StageKind> = new Set(['completed', 'reward']);
const TAIL: ReadonlySet<StageKind> = new Set(['xp', 'rankUp']);

const mergeReady = (a?: Promise<unknown>, b?: Promise<unknown>) =>
  a && b ? Promise.all([a, b]) : (a ?? b);

type XpPayload = StagePayloads['xp'];

type XpEntry = {
  id: string;
  payload: XpPayload;
  settle: (outcome: StageOutcome) => void;
  done: Promise<StageOutcome>;
};

export type XpSnapshot = { id: string; payload: XpPayload } | null;

/**
 * The XP lane: one popdown at a time, alongside the stage rather than in its
 * line. XP queued while one is showing waits, and later XP merges into the
 * one that's waiting so it fills in a single sweep.
 */
export class XpLane {
  private entries: Array<XpEntry> = [];
  private listeners = new Set<Listener>();
  private idleWaiters: Array<() => void> = [];
  private snapshot: XpSnapshot = null;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  get idle() {
    return this.entries.length === 0;
  }

  /** Resolves once nothing is showing or waiting */
  whenIdle = (): Promise<void> =>
    this.idle
      ? Promise.resolve()
      : new Promise((resolve) => this.idleWaiters.push(resolve));

  enqueue = (id: string, payload: XpPayload): Promise<StageOutcome> => {
    const existing = this.entries.find((entry) => entry.id === id);
    if (existing) return existing.done;

    // entries[0] is showing; anything behind it is waiting
    const waiting = this.entries.length > 1 ? this.entries.at(-1) : undefined;
    if (waiting) {
      waiting.payload = {
        from: waiting.payload.from,
        to: payload.to,
        gained: waiting.payload.gained + payload.gained,
      };
      return waiting.done;
    }

    let settle!: (outcome: StageOutcome) => void;
    const done = new Promise<StageOutcome>((resolve) => {
      settle = resolve;
    });
    this.entries.push({ id, payload, settle, done });
    this.emit();
    return done;
  };

  finish = (id: string) => this.remove(id, 'played');

  dismiss = (id: string) => this.remove(id, 'dismissed');

  private remove(id: string, outcome: StageOutcome) {
    const index = this.entries.findIndex((entry) => entry.id === id);
    if (index === -1) return false;
    const [entry] = this.entries.splice(index, 1);
    entry.settle(outcome);
    this.emit();
    return true;
  }

  private emit() {
    const head = this.entries[0] as XpEntry | undefined;
    if (head?.id !== this.snapshot?.id) {
      this.snapshot = head ? { id: head.id, payload: head.payload } : null;
    }
    if (this.idle) {
      const waiters = this.idleWaiters;
      this.idleWaiters = [];
      waiters.forEach((resolve) => resolve());
    }
    this.listeners.forEach((listener) => listener());
  }
}

/** The stage lane, free of React so it can be tested on its own */
export class StageQueue {
  private entries: Array<StageEntry> = [];
  private listeners = new Set<Listener>();
  private snapshot: StageSnapshot = {
    playing: null,
    busy: false,
    waiting: 0,
    cards: 0,
  };
  /** How many of each group have already been shown (played, skipped or dismissed) */
  private shownInGroup = new Map<string, number>();

  constructor(
    private readyTimeoutMs = READY_TIMEOUT_MS,
    /** Where XP popdowns play, beside the stage */
    readonly xp = new XpLane(),
  ) {}

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  /**
   * Queue an item. Resolves once it has played, been skipped (its `ready`
   * rejected or timed out) or been dismissed. Queueing an id that's already
   * waiting or playing returns that item's promise.
   *
   * XP joins the line like anything else. If XP is already waiting, the new
   * gain merges into it (from the old start to the new end) so the bar fills
   * once. Earned cards cut in ahead of waiting XP and rank-ups.
   */
  enqueue = (item: StageItem): Promise<StageOutcome> => {
    // Settled later, by us; this just stops an early rejection being reported
    item.ready?.catch(() => {});

    const existing = this.entries.find((entry) => entry.item.id === item.id);
    if (existing) return existing.done;

    if (item.kind === 'xp') {
      const waiting = this.entries.find(
        (entry) => entry.status === 'waiting' && entry.item.kind === 'xp',
      );
      if (waiting) {
        const was = waiting.item.payload as XpPayload;
        const add = item.payload as XpPayload;
        waiting.item = {
          ...waiting.item,
          payload: {
            from: was.from,
            to: add.to,
            gained: was.gained + add.gained,
          },
          ready: mergeReady(waiting.item.ready, item.ready),
        };
        return waiting.done;
      }
    }

    let settle!: (outcome: StageOutcome) => void;
    const done = new Promise<StageOutcome>((resolve) => {
      settle = resolve;
    });
    const entry: StageEntry = { item, status: 'waiting', settle, done };
    const tail = CUTS_IN.has(item.kind)
      ? this.entries.findIndex(
          (other) => other.status === 'waiting' && TAIL.has(other.item.kind),
        )
      : -1;
    if (tail === -1) this.entries.push(entry);
    else this.entries.splice(tail, 0, entry);
    this.pump();
    return done;
  };

  /** The playing item says it's finished; the next one starts */
  finish = (id: string) => {
    const head = this.entries[0] as StageEntry | undefined;
    if (head?.status !== 'playing' || head.item.id !== id) return;
    this.entries.shift();
    this.countShown(head.item);
    head.settle('played');
    this.pump();
  };

  /**
   * The X on a celebration: close what's playing and drop every card,
   * reward, XP fill and rank-up still waiting. Dropped ones count as
   * dismissed, so they're marked celebrated and won't come back.
   */
  skipRest = () => {
    const head = this.entries[0] as StageEntry | undefined;
    const dropped = this.entries.filter(
      (entry) =>
        entry !== head &&
        entry.status === 'waiting' &&
        (CUTS_IN.has(entry.item.kind) || TAIL.has(entry.item.kind)),
    );
    this.entries = this.entries.filter((entry) => !dropped.includes(entry));
    dropped.forEach((entry) => entry.settle('dismissed'));
    if (head) this.dismiss(head.item.id);
    else this.emit();
  };

  /** Drop an item, whether it's waiting, preparing or playing */
  dismiss = (id: string) => {
    // Playing XP settles through its popdown, which then frees the line
    if (this.xp.dismiss(id)) return;
    const index = this.entries.findIndex((entry) => entry.item.id === id);
    if (index === -1) return;
    const [entry] = this.entries.splice(index, 1);
    // One already on stage counts as seen; one dropped from the line doesn't
    if (index === 0) this.countShown(entry.item);
    entry.settle('dismissed');
    if (index === 0) this.pump();
    else this.emit();
  };

  private pump() {
    const head = this.entries[0] as StageEntry | undefined;
    if (head?.status !== 'waiting') return this.emit();

    // A rank-up lands once the bar that got you there has finished filling
    const ready =
      head.item.kind === 'rankUp' && !this.xp.idle
        ? mergeReady(head.item.ready, this.xp.whenIdle())
        : head.item.ready;
    if (!ready) return this.play(head);

    head.status = 'preparing';
    this.emit();
    const stillHere = () => this.entries[0] === head;
    this.withTimeout(ready).then(
      () => {
        if (stillHere()) this.play(head);
      },
      () => {
        if (!stillHere()) return;
        this.entries.shift();
        this.countShown(head.item);
        head.settle('skipped');
        this.pump();
      },
    );
  }

  /**
   * Put it on stage. XP plays in the XP lane's popdown instead, and holds the
   * line until that finishes, so whatever is behind it waits for the bar.
   */
  private play(entry: StageEntry) {
    entry.status = 'playing';
    if (entry.item.kind === 'xp') {
      const { id } = entry.item;
      void this.xp
        .enqueue(id, entry.item.payload as XpPayload)
        .then((outcome) => {
          if (this.entries[0] !== entry) return;
          this.entries.shift();
          entry.settle(outcome);
          this.pump();
        });
    }
    this.emit();
  }

  /** Rejects if `ready` hasn't settled within the ready timeout */
  private withTimeout(ready: Promise<unknown>) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Stage item never got ready')),
        this.readyTimeoutMs,
      );
    });
    return Promise.race([ready, timeout]).finally(() => clearTimeout(timer));
  }

  /** Note one more of its group is past, and forget groups that are done */
  private countShown(item: StageItem) {
    const { group } = item;
    if (!group) return;
    const left = this.entries.some((entry) => entry.item.group === group);
    if (left) {
      this.shownInGroup.set(group, (this.shownInGroup.get(group) ?? 0) + 1);
    } else {
      this.shownInGroup.delete(group);
    }
  }

  /** "2 of 5" for the playing item; more may join its group while it plays */
  private stepOf(item: StageItem): StageStep | undefined {
    const { group } = item;
    if (!group) return undefined;
    const shown = this.shownInGroup.get(group) ?? 0;
    const left = this.entries.filter(
      (entry) => entry.item.group === group,
    ).length;
    const total = shown + left;
    return total > 1 ? { index: shown + 1, total } : undefined;
  }

  private emit() {
    const head = this.entries[0] as StageEntry | undefined;
    // XP renders in its own popdown, not on the stage
    const playing =
      head?.status === 'playing' && head.item.kind !== 'xp' ? head.item : null;
    this.snapshot = {
      playing,
      step: playing ? this.stepOf(playing) : undefined,
      busy: !!head && head.status !== 'waiting',
      waiting: this.entries.filter((entry) => entry.status === 'waiting')
        .length,
      // A rank-up still waiting behind the XP doesn't hold pings; they show
      // under the bar as it fills, and any left over wait out the rank-up
      cards: this.entries.filter(
        (entry) =>
          entry.item.kind !== 'xp' &&
          !(entry.item.kind === 'rankUp' && entry.status === 'waiting'),
      ).length,
    };
    this.listeners.forEach((listener) => listener());
  }
}

/** The ticker lane: one ping at a time, repeat updates to an id merged in */
export class TickerQueue {
  private items: Array<TickerItem> = [];
  private listeners = new Set<Listener>();
  private current: TickerItem | null = null;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.current;

  /**
   * Queue a ping. If one with the same id is waiting or showing, it's updated
   * in place: it keeps its `from` and takes the new `to`, goal and label.
   */
  enqueue = (item: TickerItem) => {
    const index = this.items.findIndex((queued) => queued.id === item.id);
    if (index === -1) this.items.push(item);
    else this.items[index] = { ...item, from: this.items[index].from };
    this.emit();
  };

  finish = (id: string) => {
    const index = this.items.findIndex((queued) => queued.id === id);
    if (index === -1) return;
    this.items.splice(index, 1);
    this.emit();
  };

  /** Drop every ping, showing or waiting */
  clear = () => {
    this.items = [];
    this.emit();
  };

  private emit() {
    this.current = this.items[0] ?? null;
    this.listeners.forEach((listener) => listener());
  }
}

type Queues = { stage: StageQueue; ticker: TickerQueue };

const AnimationQueueContext = createContext<Queues | null>(null);

export type AnimationQueueApi = {
  /** Put a celebration on the stage, behind whatever is already queued */
  enqueue: (item: StageItem) => Promise<StageOutcome>;
  /** Show a small progress ping up top; never waits for the stage */
  enqueueTicker: (item: TickerItem) => void;
  /** Take an item off the stage or out of the line */
  dismiss: (id: string) => void;
  /** Whether a stage animation is showing right now */
  isPlaying: boolean;
};

export const useAnimationQueue = (): AnimationQueueApi => {
  const queues = useContext(AnimationQueueContext);
  if (!queues) {
    throw new Error('useAnimationQueue must be used in AnimationQueueProvider');
  }
  const { stage, ticker } = queues;
  const isPlaying = useSyncExternalStore(
    stage.subscribe,
    () => stage.getSnapshot().playing !== null,
  );
  return {
    enqueue: stage.enqueue,
    enqueueTicker: ticker.enqueue,
    dismiss: stage.dismiss,
    isPlaying,
  };
};

/** If an animation throws, skip it rather than jam the queue */
class SkipOnError extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Animation failed, skipping it', error, info);
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const StageSlot: FC<{
  item: StageItem;
  step?: StageStep;
  queue: StageQueue;
  ticker: TickerQueue;
}> = ({ item, step, queue, ticker }) => {
  // Stable for the item's whole run, so effects keyed on it don't restart
  const [onDone] = useState(() => () => queue.finish(item.id));
  const [onSkipAll] = useState(() => () => {
    ticker.clear();
    queue.skipRest();
  });
  const Animation = stageRegistry[item.kind] as StageComponent<StageKind>;

  return (
    <SkipOnError onError={onDone}>
      <Suspense fallback={null}>
        <Animation
          payload={item.payload}
          onDone={onDone}
          step={step}
          onSkipAll={onSkipAll}
        />
      </Suspense>
    </SkipOnError>
  );
};

const Stage: FC<{ queue: StageQueue; ticker: TickerQueue }> = ({
  queue,
  ticker,
}) => {
  const { playing, step } = useSyncExternalStore(
    queue.subscribe,
    queue.getSnapshot,
  );
  if (!playing) return null;
  return (
    <StageSlot
      key={playing.id}
      item={playing}
      step={step}
      queue={queue}
      ticker={ticker}
    />
  );
};

const XpSlot: FC<{ id: string; payload: XpPayload; lane: XpLane }> = ({
  id,
  payload,
  lane,
}) => {
  const [onDone] = useState(() => () => lane.finish(id));
  const Animation = stageRegistry.xp;
  return (
    <SkipOnError onError={onDone}>
      <Suspense fallback={null}>
        <Animation payload={payload} onDone={onDone} />
      </Suspense>
    </SkipOnError>
  );
};

const Xp: FC<{ lane: XpLane }> = ({ lane }) => {
  const current = useSyncExternalStore(lane.subscribe, lane.getSnapshot);
  if (!current) return null;
  return (
    <XpSlot
      key={current.id}
      id={current.id}
      payload={current.payload}
      lane={lane}
    />
  );
};

const TickerSlot: FC<{ item: TickerItem; queue: TickerQueue }> = ({
  item,
  queue,
}) => {
  const [onDone] = useState(() => () => queue.finish(item.id));
  return (
    <SkipOnError onError={onDone}>
      <Suspense fallback={null}>
        <TickerComponent item={item} onDone={onDone} />
      </Suspense>
    </SkipOnError>
  );
};

const Ticker: FC<{ queue: TickerQueue; stage: StageQueue }> = ({
  queue,
  stage,
}) => {
  const current = useSyncExternalStore(queue.subscribe, queue.getSnapshot);
  const cards = useSyncExternalStore(
    stage.subscribe,
    () => stage.getSnapshot().cards,
  );
  // Hold pings until the cards are done, so they land with the XP fill. One
  // already showing finishes rather than vanishing when a card turns up.
  const [started, setStarted] = useState<string | null>(null);
  const show = !!current && (cards === 0 || started === current.id);
  useEffect(() => {
    if (show) setStarted(current.id);
  }, [show, current]);
  if (!show) return null;
  // Keyed by id, so a merged update flows into the ping already showing
  return <TickerSlot key={current.id} item={current} queue={queue} />;
};

declare global {
  interface Window {
    /** Dev only: poke the animation queue from the console */
    __animations?: {
      enqueue: StageQueue['enqueue'];
      enqueueTicker: TickerQueue['enqueue'];
      dismiss: StageQueue['dismiss'];
      state: () => {
        stage: StageSnapshot;
        xp: XpSnapshot;
        ticker: TickerItem | null;
      };
    };
  }
}

/**
 * Holds both lanes and renders them after its children. Mount it once, inside
 * the router and the query client.
 */
export const AnimationQueueProvider: FC<{
  children: ReactNode;
  /** Expose it as window.__animations in dev; off for nested preview queues */
  devHandle?: boolean;
}> = ({ children, devHandle = true }) => {
  const [queues] = useState<Queues>(() => ({
    stage: new StageQueue(),
    ticker: new TickerQueue(),
  }));

  useEffect(() => {
    // Fetch the animations' code while idle, so none stutters on first play
    const idle = window.requestIdleCallback as
      | typeof window.requestIdleCallback
      | undefined;
    if (idle) {
      const handle = idle(preloadStage);
      return () => window.cancelIdleCallback(handle);
    }
    const timer = setTimeout(preloadStage, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV || !devHandle) return;
    const { stage, ticker } = queues;
    window.__animations = {
      enqueue: stage.enqueue,
      enqueueTicker: ticker.enqueue,
      dismiss: stage.dismiss,
      state: () => ({
        stage: stage.getSnapshot(),
        xp: stage.xp.getSnapshot(),
        ticker: ticker.getSnapshot(),
      }),
    };
    return () => {
      delete window.__animations;
    };
  }, [queues, devHandle]);

  return (
    <AnimationQueueContext.Provider value={queues}>
      {children}
      <Stage queue={queues.stage} ticker={queues.ticker} />
      <Xp lane={queues.stage.xp} />
      <Ticker queue={queues.ticker} stage={queues.stage} />
    </AnimationQueueContext.Provider>
  );
};
