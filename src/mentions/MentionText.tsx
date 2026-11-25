import { splitMentions } from './mentions';
import type { FC } from 'react';

/** Text with each @mention picked out in a little highlight */
export const MentionText: FC<{ text: string }> = ({ text }) => (
  <>
    {splitMentions(text).map((part, i) =>
      part.mention ? (
        <span
          key={i}
          className="px-1 rounded-md bg-sky text-ink font-bold whitespace-nowrap"
        >
          {part.text}
        </span>
      ) : (
        part.text
      ),
    )}
  </>
);
