import type { AIJudge, User } from '@/api/Api';

/** A run of text, or an @mention in it */
export type MentionPart = { text: string; mention: boolean };

/** Usernames never have spaces, so an @mention runs to the next space */
const MENTION = /(^|\s)(@[^\s@]+)/g;

/** Punctuation that ends a sentence rather than belonging to a name */
const TRAILING = /[.,!?;:)\]'"]+$/;

/**
 * Splits text into plain runs and @mentions. A mention starts a word (so an
 * email address isn't one) and leaves off trailing punctuation. Handles in
 * `ignored` (lowercased, without the @) stay plain text.
 */
export function splitMentions(
  text: string,
  ignored: ReadonlySet<string> = new Set(),
): Array<MentionPart> {
  const parts: Array<MentionPart> = [];
  let last = 0;
  for (const match of text.matchAll(MENTION)) {
    const name = match[2].replace(TRAILING, '');
    if (name.length < 2 || ignored.has(name.slice(1).toLowerCase())) continue;
    const start = match.index + match[1].length;
    if (start > last)
      parts.push({ text: text.slice(last, start), mention: false });
    parts.push({ text: name, mention: true });
    last = start + name.length;
  }
  if (last < text.length)
    parts.push({ text: text.slice(last), mention: false });
  return parts;
}

/** How an AI judge is @mentioned: their name without spaces, e.g. SirDoodleton */
export const judgeHandle = (name: string) => name.replace(/\s+/g, '');

/**
 * The lowercased handles of every judge but the one who reviewed a doodle:
 * only that judge answers there, so @ing any other one is just text.
 */
export function otherJudgeHandles(
  judgeNames: Array<string>,
  reviewer: string | null,
): Set<string> {
  const mine = reviewer && judgeHandle(reviewer).toLowerCase();
  return new Set(
    judgeNames
      .map((name) => judgeHandle(name).toLowerCase())
      .filter((handle) => handle !== mine),
  );
}

/**
 * The @mention being typed just before the caret, if any: where its @ is and
 * what's been typed after it.
 */
export function mentionAtCaret(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const match = /(^|\s)@([^\s@]*)$/.exec(text.slice(0, caret));
  if (!match) return null;
  return { start: match.index + match[1].length, query: match[2] };
}

/** Someone who can be @mentioned: a player, or an AI judge */
export type Mentionable =
  | { kind: 'user'; handle: string; user: User }
  | { kind: 'judge'; handle: string; judge: AIJudge };

/**
 * Everyone worth @mentioning on a doodle: its judge first, then the people
 * given (the artist, commenters, your friends), once each and never you.
 */
export function mentionables(
  judge: AIJudge | undefined,
  users: Array<User>,
  me: string,
): Array<Mentionable> {
  const list: Array<Mentionable> = [];
  if (judge)
    list.push({ kind: 'judge', handle: judgeHandle(judge.name), judge });
  for (const user of users) {
    if (user.id === me || list.some((m) => m.handle === user.username))
      continue;
    list.push({ kind: 'user', handle: user.username, user });
  }
  return list;
}

/** The mentionables matching what's typed after the @, best matches first */
export function matchMentions(
  list: Array<Mentionable>,
  query: string,
  limit = 6,
): Array<Mentionable> {
  const q = query.toLowerCase();
  const starts = list.filter((m) => m.handle.toLowerCase().startsWith(q));
  const contains = list.filter(
    (m) => !starts.includes(m) && m.handle.toLowerCase().includes(q),
  );
  return [...starts, ...contains].slice(0, limit);
}
