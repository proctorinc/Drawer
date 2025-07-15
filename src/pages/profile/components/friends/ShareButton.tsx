import { faShareAlt } from '@fortawesome/free-solid-svg-icons';
import Button from '@/components/Button';
import { useLocation } from '@tanstack/react-router';

export const ShareButton = () => {
  const location = useLocation();

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        text: 'Come doodle with me!',
        url: `${window.location.origin}${location.pathname}`,
      });
    } else {
      navigator.clipboard.writeText(
        `Come doodle with me! ${window.location.origin}/draw`,
      );
    }
  };

  return (
    <Button size="sm" icon={faShareAlt} onClick={handleShare}>
      Share Profile
    </Button>
  );
};
