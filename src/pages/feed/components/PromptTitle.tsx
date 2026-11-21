import { Link } from '@tanstack/react-router';
import type { CSSProperties, FC } from 'react';
import type { User } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn, dabShapes, highlightColor } from '@/utils';

/** "draw a prehistoric city", with the prompt highlighted in one of its own colors */
export const PromptTitle: FC<{
  prompt: string;
  colors: Array<string>;
  className?: string;
}> = ({ prompt, colors, className }) => (
  <h1
    className={cn(
      'font-accent font-bold text-[clamp(28px,9vw,38px)] leading-[0.95] text-balance',
      className,
    )}
  >
    draw{' '}
    <span
      className="highlight"
      style={
        { '--hl': highlightColor(colors[2] ?? '#ffd45a') } as CSSProperties
      }
    >
      {prompt.toLowerCase()}
    </span>
  </h1>
);

/** A day's three colors as big paint dabs */
export const ColorDabs: FC<{ colors: Array<string> }> = ({ colors }) => (
  <span aria-hidden="true" className="flex items-center gap-2">
    {colors.slice(0, 3).map((color, i) => (
      <span
        key={color + i}
        className={cn(
          'size-8 border-2 border-ink',
          dabShapes[i % dabShapes.length],
        )}
        style={{ backgroundColor: color }}
      />
    ))}
  </span>
);

/** Who came up with the prompt: their avatar, big enough to recognise, and name */
export const PromptCredit: FC<{ user: User; className?: string }> = ({
  user,
  className,
}) => {
  const currentUser = useUser();
  const isMe = user.id === currentUser.id;
  const linkClass = cn(
    'group flex items-center gap-3 min-w-0 w-fit',
    className,
  );
  const content = (
    <>
      {/* The link does the navigating, so the avatar's own click is a no-op */}
      <UserProfileIcon
        user={user}
        size="lg"
        showLevel={false}
        onClick={() => {}}
      />
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm leading-none text-pencil">prompt by</span>
        <span className="font-accent font-bold text-2xl leading-none truncate group-hover:underline">
          {isMe ? 'you!' : user.username}
        </span>
      </span>
    </>
  );

  return isMe ? (
    <Link to="/draw/profile/me" className={linkClass}>
      {content}
    </Link>
  ) : (
    <Link
      to="/draw/profile/$userId"
      params={{ userId: user.id }}
      className={linkClass}
    >
      {content}
    </Link>
  );
};
