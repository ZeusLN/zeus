const isValidHostAndPort = (input: string): boolean => {
    const urlPattern =
        /^(https?:\/\/)?(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])(:\d+)?$/;
    const portPattern = /:\d+$/;

    if (!urlPattern.test(input)) return false;

    const portMatch = input.match(portPattern);
    if (portMatch) {
        const port = parseInt(portMatch[0].substring(1));
        if (port < 1 || port > 65535) return false;
    }

    return true;
};

const isValidHttpsHostAndPort = (input: string): boolean => {
    const urlPattern =
        /^(https:\/\/)?(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])(:\d+)?$/;
    const portPattern = /:\d+$/;

    if (!urlPattern.test(input)) return false;

    const portMatch = input.match(portPattern);
    if (portMatch) {
        const port = parseInt(portMatch[0].substring(1));
        if (port < 1 || port > 65535) return false;
    }

    return true;
};

const isValidHostname = (hostname: string): boolean => {
    const urlPattern =
        /^(https?:\/\/)?(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/;
    return urlPattern.test(hostname);
};

const isValidPort = (port: string): boolean => {
    const portNum = parseInt(port);
    return portNum >= 1 && portNum <= 65535;
};

const hasValidRuneChars = (rune: string): boolean => {
    return /^[A-Za-z0-9\-_=]+$/.test(rune);
};

const hasValidMacaroonChars = (macaroon: string): boolean => {
    return /^[0-9a-fA-F]+$/.test(macaroon);
};

const hasValidPairingPhraseCharsAndWordcount = (phrase: string): boolean => {
    const normalizedPhrase = phrase.trim().replace(/\s+/g, ' ');
    if (!/^[a-zA-Z\s]+$/.test(normalizedPhrase)) return false;
    return normalizedPhrase.split(' ').length === 10;
};

const ValidationUtils = {
    isValidHostAndPort,
    isValidHttpsHostAndPort,
    isValidHostname,
    isValidPort,
    hasValidRuneChars,
    hasValidMacaroonChars,
    hasValidPairingPhraseCharsAndWordcount
};

export default ValidationUtils;
