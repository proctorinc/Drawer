import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useAdminSubmissions } from '../api';
import {
  AdminPage,
  Loaded,
  SearchInput,
  Swatches,
  formatDay,
} from '../components/ui';
import { RerunAIButton } from '../components/RerunAIButton';
import type { AdminSubmission } from '../api';
import type { FC } from 'react';
import { CommentIcon, HeartIcon } from '@/components/icons';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';

const DrawingTile: FC<{ submission: AdminSubmission }> = ({ submission }) => (
  <li className="flex flex-col gap-2 p-2 pb-3 bg-white border-2 border-ink rounded-sketch">
    <Link
      to="/draw/submission/$submissionId"
      params={{ submissionId: submission.id }}
      className="block aspect-square overflow-hidden border-[1.5px] border-line rounded-sketch-alt bg-paper"
    >
      <DrawingImage
        imageUrl={submission.imageUrl}
        alt={`${submission.user.username}'s ${submission.prompt}`}
        className="size-full object-contain"
      />
    </Link>
    <div className="flex items-center gap-2 px-1">
      <UserProfileIcon user={submission.user} size="sm" />
      <div className="flex flex-col flex-1 min-w-0 leading-tight">
        <span className="font-bold truncate">{submission.user.username}</span>
        <span className="text-sm text-pencil truncate">
          {submission.prompt}
        </span>
      </div>
    </div>
    <div className="flex items-center justify-between px-1 text-sm text-pencil">
      <span>{formatDay(submission.day)}</span>
      <RerunAIButton
        submissionId={submission.id}
        artist={submission.user.username}
      />
      <span className="flex items-center gap-2">
        <span className="flex items-center gap-0.5">
          <HeartIcon size={14} /> {submission.reactions}
        </span>
        <span className="flex items-center gap-0.5">
          <CommentIcon size={14} /> {submission.comments}
        </span>
      </span>
    </div>
  </li>
);

const DrawingsPage = () => {
  const submissions = useAdminSubmissions();
  const [search, setSearch] = useState('');

  return (
    <AdminPage
      title="drawings"
      subtitle="the latest 120 doodles, grouped by day"
      actions={
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="artist or prompt"
        />
      }
    >
      <Loaded query={submissions}>
        {(list) => {
          const needle = search.toLowerCase();
          const shown = list.filter(
            (s) =>
              s.user.username.toLowerCase().includes(needle) ||
              s.prompt.toLowerCase().includes(needle),
          );
          const days = [...new Set(shown.map((s) => s.day))];
          if (days.length === 0) {
            return <p className="text-pencil">no drawings found</p>;
          }
          return days.map((day) => {
            const onDay = shown.filter((s) => s.day === day);
            return (
              <section key={day} className="flex flex-col gap-3">
                <h2 className="flex items-center gap-3 font-accent font-bold text-2xl">
                  {formatDay(day)} · {onDay[0].prompt}
                  <Swatches colors={onDay[0].colors} />
                  <span className="text-lg text-pencil font-normal">
                    {onDay.length} drawn
                  </span>
                </h2>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                  {onDay.map((s) => (
                    <DrawingTile key={s.id} submission={s} />
                  ))}
                </ul>
              </section>
            );
          });
        }}
      </Loaded>
    </AdminPage>
  );
};

export default DrawingsPage;
