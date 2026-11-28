import type { FC, ReactNode } from 'react';
import type { Turn } from './speakers';
import { mentionChipClass } from '@/mentions/MentionText';
import { cn } from '@/utils';

/** What's typed out for these turns: their lines, one per line, without the speakers */
export const spokenText = (turns: Array<Turn>) =>
  turns.map((turn) => turn.line).join('\n');

type Props = {
  turns: Array<Turn>;
  /** How much of `spokenText(turns)` has typed out so far (default: all of it) */
  typed?: number;
  /** Sits at the end of what's typed, like a cursor */
  after?: ReactNode;
};

/**
 * A judge's comment, each speaker of an exchange on a line of their own with
 * their name picked out like an @mention. A comment with no speakers is just
 * its words.
 */
export const CommentLines: FC<Props> = ({ turns, typed = Infinity, after }) => {
  let left = typed;
  const shown: Array<Turn> = [];
  for (const turn of turns) {
    if (shown.length > 0 && left <= 0) break;
    shown.push({ ...turn, line: turn.line.slice(0, Math.max(0, left)) });
    left -= turn.line.length + 1;
  }

  return shown.map((turn, i) => (
    <span key={i} className="block">
      {turn.speaker && (
        <span className={cn(mentionChipClass, 'mr-1.5')}>{turn.speaker}</span>
      )}
      {turn.line}
      {i === shown.length - 1 && after}
    </span>
  ));
};
