import { faShareAlt } from '@fortawesome/free-solid-svg-icons';
import { useProfile } from '../../UserProfileContext';
import Button from '@/components/Button';

export const ShareButton = () => {
  const { userProfile } = useProfile();

  const handleShare = () => {
    if (userProfile) {
      if (navigator.share) {
        navigator.share({
          text: 'Come doodle with me!',
          url: `${window.location.origin}/app`,
        });
      } else {
        navigator.clipboard.writeText(
          `Come doodle with me! ${window.location.origin}/app`,
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
