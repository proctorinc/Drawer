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
