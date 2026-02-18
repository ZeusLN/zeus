/**
 * Returns avatar initials from a name string.
 * Uses first letter of first word and first letter of last word.
 * Examples: "Alice Bob" -> "AB", "John Quincy Adams" -> "JA", "John" -> "J"
 */
export const getAvatarInitials = (name: string | undefined): string => {
    const n = (name || '').trim();
    if (!n) return '';
    const words = n.split(/\s+/).filter(Boolean);
    const first = words[0][0] || '';
    const last = words.length > 1 ? words[words.length - 1][0] || '' : '';
    return (first + last).toUpperCase();
};
