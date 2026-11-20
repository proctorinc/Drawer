import { afterEach, describe, expect, it, vi } from 'vitest';
import { StageQueue, TickerQueue } from '../AnimationQueue';
import type { LevelSnapshot, StageItem } from '../types';

vi.mock('../registry', () => ({
  stageRegistry: {},
  TickerComponent: () => null,
  preloadStage: () => {},
}));

const level = (xp: number): LevelSnapshot => ({
  level: 1,
  xp,
  levelStartXp: 0,
  nextLevelXp: 100,
});

const review = (id: string, ready?: Promise<unknown>): StageItem => ({
  id,
  kind: 'review',
  payload: { submissionId: id },
  ready,
});

const xp = (id: string, from: number, to: number): StageItem<'xp'> => ({
  id,
  kind: 'xp',
  payload: { from: level(from), to: level(to), gained: to - from },
});

const playingId = (queue: StageQueue) => queue.getSnapshot().playing?.id;

const deferred = () => {
  let resolve!: () => void;
  let reject!: () => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('StageQueue', () => {
  it('plays one at a time, in order', async () => {
    const queue = new StageQueue();
    const first = queue.enqueue(review('a'));
    queue.enqueue(review('b'));
    expect(playingId(queue)).toBe('a');
    expect(queue.getSnapshot().waiting).toBe(1);
    queue.finish('b'); // not playing: ignored
    expect(playingId(queue)).toBe('a');
    queue.finish('a');
    await expect(first).resolves.toBe('played');
    expect(playingId(queue)).toBe('b');
    queue.finish('b');
    expect(queue.getSnapshot()).toEqual({
      playing: null,
      busy: false,
      waiting: 0,
    });
  });

  it('ignores an id that is already queued', () => {
    const queue = new StageQueue();
    const first = queue.enqueue(review('a'));
    expect(queue.enqueue(review('a'))).toBe(first);
    queue.finish('a');
    expect(playingId(queue)).toBeUndefined();
  });

  it('holds the line until ready, and skips on reject', async () => {
    const queue = new StageQueue();
    const ready = deferred();
    const held = queue.enqueue(review('r', ready.promise));
    queue.enqueue(xp('x', 0, 10));
    expect(queue.getSnapshot()).toMatchObject({ playing: null, busy: true });
    ready.resolve();
    await ready.promise;
    await Promise.resolve();
    expect(playingId(queue)).toBe('r');
    queue.finish('r');
    await expect(held).resolves.toBe('played');
    expect(playingId(queue)).toBe('x');

    const failing = deferred();
    const skipped = queue.enqueue(review('s', failing.promise));
    queue.enqueue(review('t'));
    queue.finish('x');
    failing.reject();
    await expect(skipped).resolves.toBe('skipped');
    expect(playingId(queue)).toBe('t');
  });

  it('skips an item whose ready never settles', async () => {
    vi.useFakeTimers();
    const queue = new StageQueue(1000);
    const never = queue.enqueue(review('r', new Promise(() => {})));
    queue.enqueue(review('next'));
    await vi.advanceTimersByTimeAsync(1000);
    await expect(never).resolves.toBe('skipped');
    expect(playingId(queue)).toBe('next');
  });

  it('merges xp that is still waiting', async () => {
    const queue = new StageQueue();
    queue.enqueue(review('playing'));
    const first = queue.enqueue(xp('x1', 0, 10));
    const second = queue.enqueue(xp('x2', 10, 25));
    expect(second).toBe(first);
    expect(queue.getSnapshot().waiting).toBe(1);
    queue.finish('playing');
    expect(queue.getSnapshot().playing).toMatchObject({
      id: 'x1',
      payload: { from: level(0), to: level(25), gained: 25 },
    });
    // The first is playing now, so a third queues on its own
    queue.enqueue(xp('x3', 25, 30));
    expect(queue.getSnapshot().waiting).toBe(1);
    queue.finish('x1');
    await expect(first).resolves.toBe('played');
    expect(playingId(queue)).toBe('x3');
  });

  it('dismisses waiting and playing items', async () => {
    const queue = new StageQueue();
    const a = queue.enqueue(review('a'));
    const b = queue.enqueue(review('b'));
    queue.enqueue(review('c'));
    queue.dismiss('b');
    await expect(b).resolves.toBe('dismissed');
    queue.dismiss('a');
    await expect(a).resolves.toBe('dismissed');
    expect(playingId(queue)).toBe('c');
  });
});

describe('StageQueue groups', () => {
  const inGroup = (id: string, group?: string): StageItem => ({
    ...review(id),
    group,
  });
  const step = (queue: StageQueue) => queue.getSnapshot().step;

  it('counts "x of y" through a group, then forgets it', () => {
    const queue = new StageQueue();
    queue.enqueue(inGroup('a', 'g'));
    queue.enqueue(inGroup('b', 'g'));
    queue.enqueue(inGroup('c', 'g'));
    queue.enqueue(inGroup('solo'));
    expect(step(queue)).toEqual({ index: 1, total: 3 });
    queue.finish('a');
    expect(step(queue)).toEqual({ index: 2, total: 3 });
    queue.dismiss('b'); // closed on stage: still counts as seen
    expect(step(queue)).toEqual({ index: 3, total: 3 });
    queue.finish('c');
    expect(playingId(queue)).toBe('solo');
    expect(step(queue)).toBeUndefined();
  });

  it('shows no step for a group of one, and grows as more join', () => {
    const queue = new StageQueue();
    queue.enqueue(inGroup('a', 'g'));
    expect(step(queue)).toBeUndefined();
    queue.enqueue(inGroup('b', 'g'));
    expect(step(queue)).toEqual({ index: 1, total: 2 });
  });

  it("doesn't count one dropped from the line", () => {
    const queue = new StageQueue();
    queue.enqueue(inGroup('a', 'g'));
    queue.enqueue(inGroup('b', 'g'));
    queue.enqueue(inGroup('c', 'g'));
    queue.dismiss('c');
    expect(step(queue)).toEqual({ index: 1, total: 2 });
  });
});

describe('TickerQueue', () => {
  const ping = (id: string, from: number, to: number) => ({
    id,
    kind: 'stickerProgress' as const,
    label: id,
    from,
    to,
    goal: 10,
  });

  it('plays in turn and merges repeat updates', () => {
    const queue = new TickerQueue();
    queue.enqueue(ping('a', 1, 2));
    queue.enqueue(ping('b', 0, 1));
    queue.enqueue(ping('a', 2, 3));
    expect(queue.getSnapshot()).toMatchObject({ id: 'a', from: 1, to: 3 });
    queue.finish('a');
    expect(queue.getSnapshot()?.id).toBe('b');
    queue.finish('b');
    expect(queue.getSnapshot()).toBeNull();
  });
});
