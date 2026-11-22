import { forwardRef } from 'react';
import { createLink } from '@tanstack/react-router';
import type { AnchorHTMLAttributes, FC, ReactNode } from 'react';
import { cn } from '@/utils';

export const showAllClass =
  'press flex items-center justify-between gap-2 w-full px-4 py-3 bg-white border-2 border-ink rounded-sketch font-accent font-bold text-xl leading-none hover:bg-me transition-colors cursor-pointer';

const ShowAllAnchor = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement>
>(({ className, children, ...props }, ref) => (
  <a ref={ref} {...props} className={cn(showAllClass, className)}>
    {children}
    <span aria-hidden="true">→</span>
  </a>
));

/** The "there's more where that came from" row under a shortened list */
const ShowAllLink = createLink(ShowAllAnchor);

/** Same look, for lists that unfold in place instead of opening a page */
export const ShowAllButton: FC<{
  children: ReactNode;
  onClick: () => void;
  className?: string;
}> = ({ children, onClick, className }) => (
  <button onClick={onClick} className={cn(showAllClass, className)}>
    {children}
    <span aria-hidden="true">↓</span>
  </button>
);

export default ShowAllLink;

type SectionLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /** The section's title, on the left */
  heading: ReactNode;
  /** The underlined words on the right; "see all" unless given */
  label?: ReactNode;
};

const SectionLinkAnchor = forwardRef<HTMLAnchorElement, SectionLinkProps>(
  ({ heading, label = 'see all', className, children, ...props }, ref) => (
    <a
      ref={ref}
      {...props}
      className={cn(
        'group flex items-end justify-between gap-2 w-full cursor-pointer',
        className,
      )}
    >
      <h2 className="font-accent font-bold text-[28px] leading-none">
        {heading}
      </h2>
      {children}
      <span className="flex items-center gap-1 shrink-0 font-accent font-bold text-lg leading-none">
        <span className="underline decoration-2 underline-offset-4 group-hover:decoration-coral">
          {label}
        </span>
        <span
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-1"
        >
          →
        </span>
      </span>
    </a>
  ),
);

/**
 * A section title that opens the full page: the whole header is the link,
 * with an underlined "see all →" on the right
 */
export const SectionLink = createLink(SectionLinkAnchor);
