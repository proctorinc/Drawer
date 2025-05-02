export function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export function getFirstTwoLetters(name: string): string {
    return name.substring(0, 2).toUpperCase();
}