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
        {!isSupported && (
          <div>
            <p>'Your browser does not support notifications'</p>
            <p>
              If you're using IOS, add this site to your home screen:
              https://discussions.apple.com/thread/250245967?sortBy=rank
            </p>
          </div>
        )}
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
