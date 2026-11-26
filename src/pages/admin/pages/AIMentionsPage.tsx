import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useAIMentions, useCheckAIMention } from '../api';
import { AdminPage, Loaded, Panel, formatDateTime } from '../components/ui';
import type { AIMention } from '../api';
import type { FC } from 'react';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { MentionText } from '@/mentions/MentionText';
import { cn } from '@/utils';

const isDone = (m: AIMention) => m.repliedAt !== null || m.checkedAt !== null;

/** Why a mention is done, or that it's still waiting */
const status = (m: AIMention) => {
  if (m.repliedAt)
    return `${m.repliedBy} replied ${formatDateTime(m.repliedAt)}`;
  if (m.checkedAt)
    return `checked off by ${m.checkedBy ?? 'an admin'} ${formatDateTime(m.checkedAt)}`;
  return 'waiting on a reply';
};

const MentionRow: FC<{ mention: AIMention }> = ({ mention }) => {
  const check = useCheckAIMention();
  const done = isDone(mention);
  // A judge's reply checks it off for good; only a hand check can be taken back
  const replied = mention.repliedAt !== null;

  return (
    <li
      className={cn(
        'flex items-start gap-3 p-3',
        done && 'bg-paper text-pencil',
      )}
    >
      <input
        type="checkbox"
        className="mt-1 size-5 shrink-0 accent-ink"
        aria-label={`mark ${mention.username}'s mention done`}
        title={replied ? 'a judge replied after this' : undefined}
        checked={done}
        disabled={replied || check.isPending}
        onChange={(e) =>
          check.mutate({ id: mention.commentId, checked: e.target.checked })
        }
      />
      <Link
        to="/draw/submission/$submissionId"
        params={{ submissionId: mention.submissionId }}
        className="block size-16 shrink-0 overflow-hidden border-[1.5px] border-line rounded-sketch-alt bg-white"
      >
        <DrawingImage
          imageUrl={mention.imageUrl}
          alt={mention.prompt}
          className="size-full object-contain"
        />
      </Link>
      <div className="flex flex-col flex-1 min-w-0 gap-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-bold text-ink">{mention.username}</span>
          <span className="text-sm text-pencil">
            {formatDateTime(mention.createdAt)} · {mention.prompt}
          </span>
        </div>
        <p className={cn('break-words', done ? 'line-through' : 'text-ink')}>
          <MentionText text={mention.text} />
        </p>
        <span className="text-sm text-pencil">{status(mention)}</span>
        {check.isError && (
          <span className="text-sm text-coral">{check.error.message}</span>
        )}
      </div>
    </li>
  );
};

const FILTERS = ['open', 'all'] as const;

const AIMentionsPage = () => {
  const mentions = useAIMentions();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('open');

  return (
    <AdminPage
      title="ai mentions"
      subtitle="comments that @ the judge who reviewed the doodle, oldest first. their later reply checks them off."
    >
      <Loaded query={mentions}>
        {(list) => {
          const open = list.filter((m) => !isDone(m));
          const shown = filter === 'open' ? open : list;
          return (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={filter === id}
                    onClick={() => setFilter(id)}
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 border-ink bg-white press',
                      filter === id && 'bg-butter shadow-pencil-sm',
                    )}
                  >
                    {id}
                    <span className="text-pencil">
                      {id === 'open' ? open.length : list.length}
                    </span>
                  </button>
                ))}
              </div>
              {shown.length === 0 ? (
                <p className="py-10 text-center text-pencil">
                  {filter === 'open'
                    ? 'nobody is waiting on a judge.'
                    : 'nobody has @ed a judge yet.'}
                </p>
              ) : (
                <Panel className="overflow-hidden">
                  <ul className="divide-y divide-line">
                    {shown.map((m) => (
                      <MentionRow key={m.commentId} mention={m} />
                    ))}
                  </ul>
                </Panel>
              )}
            </div>
          );
        }}
      </Loaded>
    </AdminPage>
  );
};

export default AIMentionsPage;
