// The numeric range checks below only apply to literal dotted-quad IPv4
// addresses. The WHATWG parser canonicalizes every real IPv4 host to that
// form (127.1 and 0x7f.0.0.1 both become 127.0.0.1), so anything else dotted
// is a DNS name; 127.evil.com is a legal subdomain and must not classify as
// loopback.
const isIPv4Literal = (host: string): boolean => {
    const octets = host.split('.');
    return (
        octets.length === 4 &&
        octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) < 256)
    );
};

// Loopback hosts resolve to the device itself; a cleartext fetch to one never
// leaves the phone, so it needs neither an unencrypted-transport warning nor
// Tor routing.
const isLoopbackHost = (host: string): boolean =>
    host === 'localhost' ||
    host === '::1' ||
    (isIPv4Literal(host) && host.startsWith('127.'));

// Private / non-routable hosts (loopback, RFC 1918, link-local, IPv6 ULA,
// mDNS .local). Tor exits cannot reach these, so a server on one (a BTCPay
// instance, a mempool instance on the LAN) must be contacted directly rather
// than routed over Tor. A direct request to one stays on the local network.
const isPrivateHost = (host: string): boolean =>
    isLoopbackHost(host) ||
    host === '0.0.0.0' ||
    (isIPv4Literal(host) &&
        (/^10\./.test(host) ||
            /^192\.168\./.test(host) ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
            /^169\.254\./.test(host))) ||
    /^f[cd][0-9a-f]{2}:/.test(host) || // IPv6 unique-local fc00::/7
    /^fe[89ab][0-9a-f]:/.test(host) || // IPv6 link-local fe80::/10
    host.endsWith('.local');

// The host of a URL in the form the checks above expect: lowercased, IPv6
// brackets and a trailing dot removed. Returns '' for a URL that won't parse.
const urlHost = (url: string): string => {
    try {
        return new URL(url).hostname
            .toLowerCase()
            .replace(/^\[|\]$/g, '')
            .replace(/\.$/, '');
    } catch {
        return '';
    }
};

export { isIPv4Literal, isLoopbackHost, isPrivateHost, urlHost };
