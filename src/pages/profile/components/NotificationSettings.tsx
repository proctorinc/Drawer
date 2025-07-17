import Button from '@/components/Button';
import { Card, CardContent, CardHeader } from '@/components/Card';
import { useNotifications } from '@/notifications/NotificationContext';
import { faCancel, faCircleCheck } from '@fortawesome/free-solid-svg-icons';

const NotificationSettings = () => {
  const {
    subscription,
    isSupported,
    subscribeToPush,
    unsubscribeFromPush,
    error,
  } = useNotifications();

  const isEnabled = subscription !== null;

  return (
    <Card>
      <CardContent>
        <CardHeader title="Notifications" />
        {!isSupported && <p>Your browser does not support notifications</p>}
        {isSupported && (
          <div className="flex w-full gap-2">
            <Button
              disabled={isEnabled}
              size="sm"
              className="w-full"
              onClick={() => subscribeToPush()}
              icon={faCircleCheck}
            >
              Enable{isEnabled && 'd'}
            </Button>
            <Button
              disabled={!isEnabled}
              size="sm"
              className="w-full"
              onClick={() => unsubscribeFromPush()}
              icon={faCancel}
            >
              Disable{!isEnabled && 'd'}
            </Button>
          </div>
        )}
        {error && (
          <p className="text-center text-sm font-bold text-red-700 mb-2">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
