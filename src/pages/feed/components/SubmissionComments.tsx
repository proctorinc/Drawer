import { faComment } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from '@tanstack/react-router';
import type { Comment } from '@/api/Api';
import type { FC } from 'react';
import { SpeechBox } from '@/components/SpeechBox';
import useUser from '@/auth/hooks/useUser';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { CleanText } from '@/moderation/CleanText';

type Props = {
  submissionId: string;
  comments: Array<Comment>;
};

const SubmissionComments: FC<Props> = ({ submissionId, comments }) => {
  const navigate = useNavigate();
  const currentUser = useUser();

  return (
    <div className="flex flex-col gap-2 px-2 py-1 font-semibold text-primary">
      {comments.length > 0 && (
        <SpeechBox
          portrait={<UserProfileIcon size="sm" user={comments[0].user} />}
          name={comments[0].user.username}
          mine={comments[0].user.id === currentUser.id}
        >
          <p className="leading-snug break-words">
            <CleanText text={comments[0].text} />
          </p>
        </SpeechBox>
      )}
      <button
        className="ml-2 flex gap-1.5 items-center"
        onClick={() => navigate({ to: `/draw/submission/${submissionId}` })}
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
