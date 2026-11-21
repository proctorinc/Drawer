/**
 * The animation queue: celebrations take turns instead of piling up.
 *
 * - The stage plays one full-attention animation at a time, first in first
 *   out. An item with `ready` holds the line until that promise settles (or
 *   skips itself after READY_TIMEOUT_MS); anything queued behind it waits.
 * - The ticker plays small top pings one after another in its own lane, and
 *   never waits for the stage.
 * - XP has a lane of its own too, so the bar fills the moment you earn it:
 *   XP that came with a stage item (an achievement, a quest) pops down as that
 *   item comes on stage, and XP on its own pops down straight away, over
 *   whatever is playing. A rank-up waits for the XP lane to clear, since it's
 *   the bar that carries you there.
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
};

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
  private snapshot: StageSnapshot = { playing: null, busy: false, waiting: 0 };
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
   * An `xp` item skips the line: it goes to the XP lane as soon as it's
   * ready, and plays over whatever is on stage.
   */
  enqueue = (item: StageItem): Promise<StageOutcome> => {
    // Settled later, by us; this just stops an early rejection being reported
    item.ready?.catch(() => {});

    if (item.kind === 'xp') {
      const payload = item.payload as XpPayload;
      if (!item.ready) return this.xp.enqueue(item.id, payload);
      return this.withTimeout(item.ready).then(
        () => this.xp.enqueue(item.id, payload),
        () => 'skipped' as const,
      );
    }

    const existing = this.entries.find((entry) => entry.item.id === item.id);
    if (existing) return existing.done;

    let settle!: (outcome: StageOutcome) => void;
    const done = new Promise<StageOutcome>((resolve) => {
      settle = resolve;
    });
    this.entries.push({ item, status: 'waiting', settle, done });
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

  /** Drop an item, whether it's waiting, preparing or playing */
  dismiss = (id: string) => {
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
        // The XP was still earned, so it still shows
        this.handOffXp(head.item);
        head.settle('skipped');
        this.pump();
      },
    );
  }

  /** Put it on stage, with its XP popping down at the same moment */
  private play(entry: StageEntry) {
    entry.status = 'playing';
    this.handOffXp(entry.item);
    this.emit();
  }

  private handOffXp(item: StageItem) {
    if (item.xp) void this.xp.enqueue(`xp:${item.id}`, item.xp);
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
    const playing = head?.status === 'playing' ? head.item : null;
    this.snapshot = {
      playing,
      step: playing ? this.stepOf(playing) : undefined,
      busy: !!head && head.status !== 'waiting',
      waiting: this.entries.filter((entry) => entry.status === 'waiting')
        .length,
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
}> = ({ item, step, queue }) => {
  // Stable for the item's whole run, so effects keyed on it don't restart
  const [onDone] = useState(() => () => queue.finish(item.id));
  const Animation = stageRegistry[item.kind] as StageComponent<StageKind>;

  return (
    <SkipOnError onError={onDone}>
      <Suspense fallback={null}>
        <Animation payload={item.payload} onDone={onDone} step={step} />
      </Suspense>
    </SkipOnError>
  );
};

const Stage: FC<{ queue: StageQueue }> = ({ queue }) => {
  const { playing, step } = useSyncExternalStore(
    queue.subscribe,
    queue.getSnapshot,
  );
  if (!playing) return null;
  return (
    <StageSlot key={playing.id} item={playing} step={step} queue={queue} />
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

const Ticker: FC<{ queue: TickerQueue }> = ({ queue }) => {
  const current = useSyncExternalStore(queue.subscribe, queue.getSnapshot);
  if (!current) return null;
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
export const AnimationQueueProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
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
    if (!import.meta.env.DEV) return;
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
  }, [queues]);

  return (
    <AnimationQueueContext.Provider value={queues}>
      {children}
      <Stage queue={queues.stage} />
      <Xp lane={queues.stage.xp} />
      <Ticker queue={queues.ticker} />
    </AnimationQueueContext.Provider>
  );
};
