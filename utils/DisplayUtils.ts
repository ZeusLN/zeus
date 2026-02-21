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

/**
 * Returns the uppercased initial of the main domain name from a URL.
 * Skips subdomains (including www) and the TLD.
 * Examples: "https://mint.minibits.cash" -> "M", "https://testnut.cashu.space" -> "C"
 */
export const getHostnameInitial = (url: string | null | undefined): string => {
    if (!url) return '';
    try {
        const hostname = new URL(url).hostname;
        const parts = hostname.split('.');
        // Need at least 2 parts (domain + TLD) to extract a domain name
        if (parts.length < 2) return '';
        // Main domain is second-to-last part (skip subdomains and TLD)
        const domain = parts[parts.length - 2];
        return domain[0]?.toUpperCase() || '';
    } catch {
        return '';
    }
};
