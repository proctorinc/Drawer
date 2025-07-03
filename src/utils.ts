import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ClassValue } from 'clsx';

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
