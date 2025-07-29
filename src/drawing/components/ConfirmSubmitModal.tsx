import Button from '@/components/Button';
import { Card, CardContent, CardHeader } from '@/components/Card';
import { faCheckCircle } from '@fortawesome/free-regular-svg-icons';
import { faPencil } from '@fortawesome/free-solid-svg-icons';

type ConfirmSubmitModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

const ConfirmSubmitModal: React.FC<ConfirmSubmitModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) {
    return <></>;
  }

  const handleOutsideClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="absolute top-0 flex items-center justify-center w-full h-screen backdrop-blur-xs bg-base/50 p-4"
      onClick={handleOutsideClick}
    >
      <Card>
        <CardContent>
          <CardHeader
            title="Ready to submit?"
            subtitle="You won't be able to edit your drawing later"
          />
          <div className="flex w-full gap-2">
            <Button
              icon={faCheckCircle}
              className=""
              variant="base"
              onClick={onSubmit}
            >
              Yes
            </Button>
            <Button
              className="w-full px-0"
              icon={faPencil}
              variant="primary"
              onClick={onClose}
            >
              Keep drawing
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmSubmitModal;
