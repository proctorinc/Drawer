export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('This browser does not support notifications.');
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    alert('Notifications enabled!');
    // Next: subscribe to push service
  } else if (permission === 'denied') {
    alert('Notifications denied.');
  } else {
    alert('Notification permission dismissed.');
  }
}

export function openNotificationSettings() {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome')) {
    window.open('chrome://settings/content/notifications');
  } else if (ua.includes('Firefox')) {
    window.open('about:preferences#privacy');
  } else if (ua.includes('Safari') && /iPad|iPhone|iPod/.test(ua)) {
    alert(
      'Go to iOS Settings > Notifications > [Your App Name] to disable notifications.',
    );
  } else {
    alert(
      'Please use your browser settings to disable notifications for this site.',
    );
  }
}
