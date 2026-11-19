import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useActivityLog } from '../api';
import {
  AdminPage,
  Loaded,
  Panel,
  Tag,
  formatDateTime,
} from '../components/ui';
import type { FC, ReactNode } from 'react';
import type { LogEntry, LogKind } from '../api';
import type { User } from '@/api/Api';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { ReactionSticker } from '@/reactions/ReactionSticker';
import { cn } from '@/utils';

const KINDS: Record<LogKind, { label: string; color: string }> = {
  signup: { label: 'signed up', color: 'bg-sky' },
  drawing: { label: 'drawing', color: 'bg-butter' },
  comment: { label: 'comment', color: 'bg-blush' },
  reaction: { label: 'reaction', color: 'bg-white' },
  friend_request: { label: 'friend request', color: 'bg-paper' },
  friend_accepted: { label: 'new friends', color: 'bg-paper' },
  poke: { label: 'poke', color: 'bg-paper' },
  achievement: { label: 'achievement', color: 'bg-butter' },
  suggestion: { label: 'suggestion', color: 'bg-sky' },
};

const Name: FC<{ user: User | null }> = ({ user }) => (
  <b className="font-bold">{user?.username ?? 'someone'}</b>
);

/** What happened, as a sentence */
function describe(entry: LogEntry): ReactNode {
  const { actor, target, detail } = entry;
  switch (entry.kind) {
    case 'signup':
      return (
        <>
          <Name user={actor} /> joined drawer
        </>
      );
    case 'drawing':
      return (
        <>
          <Name user={actor} /> drew “{detail}”
        </>
      );
    case 'comment':
      return (
        <>
          <Name user={actor} /> commented on <Name user={target} />
          ’s drawing: “{detail}”
        </>
      );
    case 'reaction':
      return (
        <>
          <Name user={actor} /> reacted
          <ReactionSticker reactionId={detail} size={20} className="inline" />
          to <Name user={target} />
        </>
      );
    case 'friend_request':
      return (
        <>
          <Name user={actor} /> asked <Name user={target} /> to be friends
          {detail === 'pending' && <Tag>pending</Tag>}
        </>
      );
    case 'friend_accepted':
      return (
        <>
          <Name user={actor} /> accepted <Name user={target} />
        </>
      );
    case 'poke':
      return (
        <>
          <Name user={actor} /> poked <Name user={target} />
        </>
      );
    case 'achievement':
      return (
        <>
          <Name user={actor} /> earned “{detail}”
        </>
      );
    case 'suggestion':
      return (
        <>
          <Name user={actor} /> suggested the prompt “{detail}”
        </>
      );
  }
}

export const LogRow: FC<{ entry: LogEntry }> = ({ entry }) => (
  <li className="flex items-center gap-3 py-2 border-b border-line last:border-0">
    <UserProfileIcon user={entry.actor ?? undefined} size="sm" />
    <Tag className={cn('w-32 justify-center', KINDS[entry.kind].color)}>
      {KINDS[entry.kind].label}
    </Tag>
    <span className="flex-1 min-w-0 flex flex-wrap items-center gap-1">
      {describe(entry)}
    </span>
    {entry.submissionId && (
      <Link
        to="/draw/submission/$submissionId"
        params={{ submissionId: entry.submissionId }}
        className="text-sm text-pencil underline whitespace-nowrap"
      >
        open drawing
      </Link>
    )}
    <time className="w-32 text-right text-sm text-pencil whitespace-nowrap">
      {entry.at ? formatDateTime(entry.at) : '–'}
    </time>
  </li>
);

const ActivityPage = () => {
  const log = useActivityLog();
  const [hidden, setHidden] = useState<Set<LogKind>>(new Set());

  const toggle = (kind: LogKind) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  return (
    <AdminPage
      title="activity log"
      subtitle="everything anyone did, newest first (last 300 things)"
    >
      <div className="flex flex-wrap gap-2">
        {(Object.keys(KINDS) as Array<LogKind>).map((kind) => (
          <button
            key={kind}
            onClick={() => toggle(kind)}
            className={cn(
              'cursor-pointer',
              hidden.has(kind) && 'opacity-40 line-through',
            )}
          >
            <Tag className={KINDS[kind].color}>{KINDS[kind].label}</Tag>
          </button>
        ))}
      </div>
      <Panel className="px-4">
        <Loaded query={log}>
          {(entries) => (
            <ul>
              {entries
                .filter((e) => !hidden.has(e.kind))
                .map((entry, i) => (
                  <LogRow key={i} entry={entry} />
                ))}
            </ul>
          )}
        </Loaded>
      </Panel>
    </AdminPage>
  );
};

export default ActivityPage;
