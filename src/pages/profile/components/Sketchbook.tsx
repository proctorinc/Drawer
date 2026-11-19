import { Link } from '@tanstack/react-router';
import FavoriteSubmissions from './FavoriteSubmissions';
import SubmissionCalendar from './SubmissionCalendar';
import type { FC, ReactNode } from 'react';
import type { GetMeResponse } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import Banner from '@/components/Banner';
import { PencilIcon } from '@/components/icons';

const EmptyBook: FC<{ profile: GetMeResponse; isMe: boolean }> = ({
  profile,
  isMe,
}) =>
  isMe ? (
    <Link
      to="/draw"
      className="press flex flex-col items-center gap-2 w-full px-6 py-8 bg-white border-2 border-dashed border-ink rounded-sketch text-center"
    >
      <PencilIcon size={36} className="animate-nudge" />
      <span className="font-accent font-bold text-2xl leading-none">
        your book is blank!
      </span>
      <span className="text-pencil">
        draw today's doodle to fill the first page
      </span>
    </Link>
  ) : (
    <Banner className="bg-paper border-dashed">
      {profile.user.username} hasn't doodled yet. any day now…
    </Banner>
  );

type Props = {
  profile: GetMeResponse;
  /** Right end of the hall of fame's title row */
  aside?: ReactNode;
};

/** The heart of a profile: the best doodles, then a calendar of every one */
const Sketchbook: FC<Props> = ({ profile, aside }) => {
  const currentUser = useUser();
  const isMe = currentUser.id === profile.user.id;

  if (profile.prompts.length === 0) {
    return <EmptyBook profile={profile} isMe={isMe} />;
  }

  return (
    <>
      <FavoriteSubmissions profile={profile} aside={aside} />
      <SubmissionCalendar profile={profile} />
    </>
  );
};

export default Sketchbook;
