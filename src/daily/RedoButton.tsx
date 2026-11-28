import { Link } from '@tanstack/react-router';
import type { FC } from 'react';
import { useGetRedos } from '@/api/Api';
import { RedoIcon } from '@/components/icons';
import { cn } from '@/utils';

/**
 * The way to your redos: shown only while there's a missed prompt you can
 * redo, with a redo you hold or a free one for a missed event day.
 */
export const RedoButton: FC<{ className?: string }> = ({ className }) => {
  const { data } = useGetRedos();
  if (!data || data.prompts.length === 0) {
    return null;
  }
  const count = data.grants.length + data.freeDays.length;

  return (
    <Link
      to="/draw/redo"
      className={cn(
        'press inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-ink rounded-sketch-alt shadow-pencil-sm text-base leading-none rotate-1 hover:rotate-0 transition-[rotate] duration-300',
        className,
      )}
    >
      <RedoIcon size={15} className="flex-none" />
      <span>
        you have{' '}
        <span className="font-accent font-bold">
          {count === 1 ? 'a redo' : `${count} redos`}
        </span>
      </span>
    </Link>
  );
};
