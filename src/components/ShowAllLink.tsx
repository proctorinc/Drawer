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
