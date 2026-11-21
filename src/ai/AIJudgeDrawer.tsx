import { AIJudgeAvatar } from './AIJudgeAvatar';
import { AI_SCORE_MAX, formatScore } from './score';
import type { FC } from 'react';
import type { AICriterionScore, AIJudge } from '@/api/Api';
import Sheet from '@/pages/profile/components/Sheet';

/** A criterion, with this doodle's score once it has one */
type Criterion = Omit<AICriterionScore, 'score'> & { score?: number };

type Props = {
  judge: AIJudge;
  /** What they score: the ones a doodle was judged on, or today's */
  criteria: Array<Criterion>;
  /** This doodle's overall score; leave it out before there is one */
  score?: number | null;
  /** A line under the intro, e.g. that they'll judge your doodle today */
  note?: string;
  open: boolean;
  onClose: () => void;
};

/**
 * About an AI judge: who they are, that they're an AI, and how they score.
 * Given a doodle's scores, it shows those too.
 */
export const AIJudgeDrawer: FC<Props> = ({
  judge,
  criteria,
  score,
  note,
  open,
  onClose,
}) => {
  const done = score !== undefined && score !== null;

  return (
    <Sheet title={judge.name} open={open} onClose={onClose}>
      <div className="flex items-center gap-5">
        <AIJudgeAvatar judge={judge} size="xl" className="mt-2" />
        <div className="flex flex-col gap-1.5">
          <span className="self-start px-2 rounded-full border-[1.5px] border-ink bg-sky text-sm font-bold">
            judge
          </span>
          <p className="text-secondary leading-snug">
            Not a real person. An AI that scores doodles out of {AI_SCORE_MAX}{' '}
            and leaves a comment in character.
          </p>
        </div>
      </div>

      {note && <p className="font-semibold">{note}</p>}

      {judge.bio && <p className="text-lg leading-snug">{judge.bio}</p>}

      <section className="flex flex-col gap-3">
        <h3 className="font-accent font-bold text-2xl leading-none">
          how they judge
        </h3>
        {criteria.length === 0 ? (
          <p className="text-secondary">
            One overall score out of {AI_SCORE_MAX}, gut feeling and all.
          </p>
        ) : (
          <>
            <p className="text-secondary">
              Each of these out of {AI_SCORE_MAX}. The overall score is their
              average.
            </p>
            <ul className="flex flex-col gap-2">
              {criteria.map((criterion) => (
                <li
                  key={criterion.id}
                  className="flex items-center gap-3 p-3 bg-white border-2 border-ink rounded-sketch-alt"
                >
                  <span className="grid place-items-center size-10 flex-none">
                    {criterion.imageUrl ? (
                      <img
                        src={criterion.imageUrl}
                        alt=""
                        className="size-9 object-contain"
                      />
                    ) : (
                      <span className="size-3 rounded-full bg-ink" />
                    )}
                  </span>
                  <span className="flex flex-col flex-1 min-w-0">
                    <b className="font-accent text-xl leading-tight">
                      {criterion.name}
                    </b>
                    {criterion.description && (
                      <span className="text-secondary text-sm leading-snug">
                        {criterion.description}
                      </span>
                    )}
                  </span>
                  {criterion.score !== undefined && (
                    <span className="font-accent font-bold text-xl whitespace-nowrap">
                      {criterion.score}
                      <span className="text-sm text-pencil">
                        /{AI_SCORE_MAX}
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {done && (
        <p className="flex items-baseline gap-2 font-semibold">
          this doodle got
          <span className="font-accent font-bold text-3xl">
            {formatScore(score)}
          </span>
          <span className="text-pencil">/ {AI_SCORE_MAX}</span>
        </p>
      )}
    </Sheet>
  );
};
