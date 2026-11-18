import Button from '@/components/Button';
import { Card, CardContent, CardHeader } from '@/components/Card';
import { useNotifications } from '@/notifications/NotificationContext';

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
        <CardHeader
          title="notifications"
          subtitle={
            isSupported
              ? isEnabled
                ? "on: we'll poke you about new doodles"
                : 'off'
              : "this browser can't do notifications"
          }
        >
          {isSupported && (
            <Button
              size="sm"
              variant={isEnabled ? 'base' : 'primary'}
              onClick={() =>
                isEnabled ? unsubscribeFromPush() : subscribeToPush()
              }
            >
              {isEnabled ? 'turn off' : 'turn on'}
            </Button>
          )}
        </CardHeader>
        {error && <p className="text-coral">{error}</p>}
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
