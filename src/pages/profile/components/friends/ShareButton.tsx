import { faShareAlt } from '@fortawesome/free-solid-svg-icons';
import { useProfile } from '../../UserProfileContext';
import Button from '@/components/Button';

export const ShareButton = () => {
  const { userProfile } = useProfile();

  const handleShare = () => {
    if (userProfile) {
      if (navigator.share) {
        navigator.share({
          text: `Hey, let's draw! ${window.location.origin}/app/add-friend/${userProfile.user.id}`,
        });
      } else {
        navigator.clipboard.writeText(
          `Hey, let's draw! ${window.location.origin}/app/add-friend/${userProfile.user.id}`,
        );
      }
    }
  };

  return (
    <Button size="sm" variant="base" icon={faShareAlt} onClick={handleShare}>
      Share
    </Button>
  );
};
