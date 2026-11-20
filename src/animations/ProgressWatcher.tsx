import useProgressWatcher from './useProgressWatcher';
import type { FC } from 'react';
import useAuth from '@/auth/hooks/useAuth';

const Watcher: FC<{ userId: string }> = ({ userId }) => {
  useProgressWatcher(userId);
  return null;
};

/**
 * Queues XP, rank, achievement, sticker and quest celebrations as they're
 * earned. Mount once, inside the animation queue's provider; renders nothing.
 */
const ProgressWatcher: FC = () => {
  const { user } = useAuth();
  if (!user) return null;
  // Keyed so switching accounts (or impersonating) starts fresh
  return <Watcher key={user.id} userId={user.id} />;
};

export default ProgressWatcher;
