import { reactionImageUrl } from './catalog';
import type { FC } from 'react';
import type { ReactionId } from '@/api/Api';
import { cn } from '@/utils';

type Props = {
  reactionId: ReactionId;
  size?: number;
  className?: string;
};

/** A reaction's picture. Decorative, so whatever wraps it carries the label */
export const ReactionSticker: FC<Props> = ({
  reactionId,
  size = 20,
  className,
}) => (
  <img
    src={reactionImageUrl(reactionId)}
    width={size}
    height={size}
    alt=""
    draggable={false}
    className={cn('select-none pointer-events-none', className)}
  />
);
