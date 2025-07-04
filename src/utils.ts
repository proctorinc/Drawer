import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ClassValue } from 'clsx';
import type { ReactionId } from './api/Api';
import {
  faFaceGrinSquintTears,
  faFaceMeh,
  faFire,
  faHeart,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { cva } from 'class-variance-authority';

export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs));
}

export function nameToColor(name: string) {
  const letters = getTwoCapitalLetters(name);
  let hash = 0;
  for (let i = 0; i < letters.length; i++) {
    hash = letters.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = ((hash % 360) + 360) % 360;
  const saturation = 50;
  const lightness = 70;

  return {
    primary: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    secondary: `hsl(${hue}, ${saturation}%, 90%)`,
    text: `hsl(${hue}, ${saturation}%, 30%)`,
  };
}

export function getTwoCapitalLetters(input: string): string {
  const cleaned = input.trim();

  const words = cleaned
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let initials = '';
  if (words.length >= 2) {
    initials = words[0][0] + words[1][0];
  } else if (words.length === 1) {
    initials = words[0].slice(0, 2);
  } else {
    initials = cleaned.slice(0, 2);
  }

  return initials.toUpperCase();
}

export function timeAgo(date: Date | string): string {
  const now = new Date();
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export const reactionIndicatorVariants = cva(
  'z-20 bg-base gap-1 text-sm w-12 h-8 text-card-foreground rounded-full whitespace-nowrap transition-opacity duration-200 font-bold shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]',
  {
    variants: {
      icon: {
        heart: 'text-red-500/50 bg-red-400/40 shadow-red-500/50',
        'cry-laugh': 'text-blue-600/50 bg-blue-400/40 shadow-blue-500/50',
        fire: 'text-orange-600/50 bg-orange-400/40 shadow-orange-500/50',
        'face-meh': 'text-purple-600/50 bg-purple-400/40 shadow-purple-500/50',
      },
    },
    defaultVariants: {
      icon: 'heart',
    },
  },
);

export type ReactionItem = {
  id: ReactionId;
  icon: IconDefinition;
};

export const reactions: ReactionItem[] = [
  { id: 'heart', icon: faHeart },
  { id: 'cry-laugh', icon: faFaceGrinSquintTears },
  { id: 'fire', icon: faFire },
  { id: 'face-meh', icon: faFaceMeh },
];

export function getReactionIcon(reactionId: string) {
  return reactions.find((reaction) => reaction.id === reactionId);
}
