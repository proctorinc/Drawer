import { useMemo } from 'react';
import { otherJudgeHandles, splitMentions } from './mentions';
import type { FC } from 'react';
import { useJudgeNames } from '@/ai/useJudgeNames';

type Props = {
  text: string;
  /**
   * The name of the judge who reviewed the doodle (null: none did). When given,
   * @ing any other judge reads as plain text. Leave it out where it's unknown.
   */
  judge?: string | null;
};

/** Text with each @mention picked out in a little highlight */
export const MentionText: FC<Props> = ({ text, judge }) => {
  const knowsJudge = judge !== undefined;
  const { data: judgeNames } = useJudgeNames(knowsJudge);
  const ignored = useMemo(
    () =>
      knowsJudge && judgeNames
        ? otherJudgeHandles(judgeNames, judge)
        : undefined,
    [knowsJudge, judgeNames, judge],
  );

  return (
    <>
      {splitMentions(text, ignored).map((part, i) =>
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
};
