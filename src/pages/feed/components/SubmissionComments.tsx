import type { Comment } from '@/api/Api';
import { UserProfileIcon } from '@/pages/profile/components/UserProfileIcon';
import { faComment } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from '@tanstack/react-router';
import type { FC } from 'react';

type Props = {
  submissionId: string;
  comments: Comment[];
};

const SubmissionComments: FC<Props> = ({ submissionId, comments }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-3 px-2 py-1 font-semibold text-primary">
      {comments.length > 0 && (
        <div className="flex gap-2 items-center">
          <UserProfileIcon size="sm" user={comments[0].user} />{' '}
          {comments[0].text}
        </div>
      )}
      <button
        className="flex gap-1.5 items-center"
        onClick={() => navigate({ to: `/app/submission/${submissionId}` })}
      >
        <FontAwesomeIcon icon={faComment} />
        {comments.length === 0 && <span>Add a comment</span>}
        {comments.length === 1 && <span>view 1 comment</span>}
        {comments.length > 1 && <span>view {comments.length} comments</span>}
      </button>
    </div>
  );
};

export default SubmissionComments;
