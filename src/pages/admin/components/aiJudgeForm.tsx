import { faPlus } from '@fortawesome/free-solid-svg-icons';
import type { FC, ReactNode } from 'react';
import type { AICriterion, AIPersonality, AIVerdict } from '../api';
import { AIReviewComment } from '@/ai/AIReviewComment';
import { AI_SCORE_MAX } from '@/ai/score';
import Button from '@/components/Button';

// The pieces of a judge's form, shared by the judges page and the testing ground

export const MAX_CRITERIA = 3;

export const inputClass =
  'w-full px-3 py-2 bg-white border-2 border-ink rounded-sketch-alt focus:outline-none focus:ring-2 focus:ring-butter';

export const Field: FC<{
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}> = ({ label, hint, children }) => (
  <label className="flex flex-col gap-1">
    <span className="font-bold">{label}</span>
    {children}
    {hint && <span className="text-sm text-pencil">{hint}</span>}
  </label>
);

export const ErrorText: FC<{ error: Error | null }> = ({ error }) =>
  error ? <p className="text-coral">{error.message}</p> : null;

export const CriteriaEditor: FC<{
  criteria: Array<AICriterion>;
  onChange: (criteria: Array<AICriterion>) => void;
}> = ({ criteria, onChange }) => {
  const set = (i: number, patch: Partial<AICriterion>) =>
    onChange(criteria.map((c, j) => (i === j ? { ...c, ...patch } : c)));

  return (
    // Criteria rows keep their width; narrow screens scroll them sideways
    <div className="flex flex-col gap-3 overflow-x-auto pb-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="font-bold">criteria</span>
        <span className="text-sm text-pencil">
          up to {MAX_CRITERIA}, each out of {AI_SCORE_MAX}. With none, the judge
          gives one overall score out of {AI_SCORE_MAX}; with some, it's their
          average to one decimal.
        </span>
      </div>
      {criteria.map((c, i) => (
        <div
          key={c.id || i}
          className="grid grid-cols-[2.5rem_minmax(0,8rem)_minmax(0,1fr)_minmax(0,11rem)_auto] gap-2 items-center min-w-[560px]"
        >
          <span className="grid place-items-center size-10 border-2 border-dashed border-line rounded-sketch-alt">
            {c.imageUrl ? (
              <img src={c.imageUrl} alt="" className="size-7 object-contain" />
            ) : (
              <span className="text-pencil">{i + 1}</span>
            )}
          </span>
          <input
            className={inputClass}
            placeholder="name"
            value={c.name}
            onChange={(e) => set(i, { name: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="what it measures (the model reads this)"
            value={c.description}
            onChange={(e) => set(i, { description: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="artwork url, e.g. /reactions/star.png"
            value={c.imageUrl}
            onChange={(e) => set(i, { imageUrl: e.target.value })}
          />
          <button
            type="button"
            aria-label={`remove ${c.name || 'criterion'}`}
            className="px-2 text-pencil hover:text-coral cursor-pointer"
            onClick={() => onChange(criteria.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      {criteria.length < MAX_CRITERIA && (
        <Button
          size="sm"
          variant="base"
          type="button"
          icon={faPlus}
          className="self-start"
          disableLoad
          onClick={() =>
            onChange([
              ...criteria,
              { id: '', name: '', description: '', imageUrl: '' },
            ])
          }
        >
          add criterion
        </Button>
      )}
    </div>
  );
};

/** A judge's comment, drawn the way players would see it */
export const VerdictPreview: FC<{
  verdict: AIVerdict;
  personality: Pick<
    AIPersonality,
    'id' | 'name' | 'bio' | 'avatarUrl' | 'decoration'
  >;
  submissionId: string;
}> = ({ verdict, personality, submissionId }) => (
  <div className="flex flex-col gap-1">
    <AIReviewComment
      review={{
        submissionId,
        judge: personality,
        status: 'done',
        score: verdict.score,
        criteria: verdict.criteria,
        comment: verdict.comment,
        createdAt: new Date().toISOString(),
      }}
    />
  </div>
);
