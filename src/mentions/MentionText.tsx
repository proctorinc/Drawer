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
export const MentionText: FC<Props> = ({ text, judge }) =>
  judge === undefined ? (
    <Highlighted text={text} />
  ) : (
    <OnlyReviewerHighlighted text={text} judge={judge} />
  );

/** Leaves every judge but the reviewer as plain text, once their names load */
const OnlyReviewerHighlighted: FC<{ text: string; judge: string | null }> = ({
  text,
  judge,
}) => {
  const { data: judgeNames } = useJudgeNames();
  const ignored = useMemo(
    () => judgeNames && otherJudgeHandles(judgeNames, judge),
    [judgeNames, judge],
  );
  return <Highlighted text={text} ignored={ignored} />;
};

const Highlighted: FC<{ text: string; ignored?: ReadonlySet<string> }> = ({
  text,
  ignored,
}) => (
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
