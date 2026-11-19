import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import type { ClassValue } from 'clsx';
import type { User } from './api/Api';

// Teach tailwind-merge our custom utilities so overrides replace them
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      shadow: ['shadow-pencil', 'shadow-pencil-sm'],
      rounded: ['rounded-sketch', 'rounded-sketch-alt', 'rounded-blob'],
    },
  },
});

export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs));
}

export function nameToColor(name: string) {
  const modified = getTwoCapitalLetters(name);
  let hash = 0;
  for (let i = 0; i < modified.length; i++) {
    hash = modified.charCodeAt(i) + ((hash << 5) - hash);
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

export function isFriend(userId: string, friends: Array<User>) {
  return friends?.some((friend) => friend.id === userId);
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

/** Irregular blob corners, so color swatches look like dabs of paint */
export const dabShapes = [
  'rounded-blob',
  'rounded-[45%_55%_40%_60%/55%_45%_60%_40%]',
  'rounded-[52%_48%_62%_38%/42%_60%_40%_58%]',
];

/** A see-through marker stroke in one of the given colors */
export function highlightColor(color: string) {
  return `color-mix(in srgb, ${color} 55%, transparent)`;
}
