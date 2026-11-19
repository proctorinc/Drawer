import type { CSSProperties, FC } from 'react';
import { cn, dabShapes, tapeColor } from '@/utils';

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
      style={{ '--hl': tapeColor(colors[2] ?? '#ffd45a') } as CSSProperties}
    >
      {prompt.toLowerCase()}
    </span>
  </h1>
);

/** A day's three colors as big paint dabs */
export const ColorDabs: FC<{ colors: Array<string>; size?: 'sm' | 'lg' }> = ({
  colors,
  size = 'lg',
}) => (
  <span
    aria-hidden="true"
    className={cn('flex items-center', size === 'lg' ? 'gap-2' : 'gap-1')}
  >
    {colors.slice(0, 3).map((color, i) => (
      <span
        key={color + i}
        className={cn(
          'border-ink',
          size === 'lg' ? 'size-8 border-2' : 'size-4 border-[1.5px]',
          dabShapes[i % dabShapes.length],
        )}
        style={{ backgroundColor: color }}
      />
    ))}
  </span>
);
