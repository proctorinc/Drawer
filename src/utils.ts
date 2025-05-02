import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function nameToColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
  
    const hue = ((hash % 360) + 360) % 360;
    const saturation = 70;
    const lightness = 70;
  
    const primary = `hsl(${hue}, ${saturation}%, ${lightness}%)`
    const secondary = `hsl(${hue - 180}, ${saturation}%, ${lightness}%)`
    const text = "#000000";

    return { primary, secondary, text }
}

export function getTwoCapitalLetters(input: string): string {
    const cleaned = input.trim();

    const words = cleaned
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_\-.]+/g, " ")
        .split(/\s+/)
        .filter(Boolean);

    let initials = "";
    if (words.length >= 2) {
        initials = words[0][0] + words[1][0];
    } else if (words.length === 1) {
        initials = words[0].slice(0, 2);
    } else {
        initials = cleaned.slice(0, 2);
    }

    return initials.toUpperCase();
}
