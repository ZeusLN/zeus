// we  incorporate domains (incl. optional subdomains), IPv4, IPv6 and local hostnames ('localhost' etc.)
const HOST_REGEX =
    /^(([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}|\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b|\[(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:))\]|[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)$/;
// in paths we have more allowed chars
const PATH_REGEX = /^\/([a-zA-Z0-9\-._~!$&'()*+,;=]+\/?)*$/;
const PORT_REGEX = /^:\d+$/;

interface ValidationOptions {
    requireHttps?: boolean;
    allowPort?: boolean;
}

// Convert protocol (if present) to lowercase while preserving the rest of the URL
// This handles case-insensitive protocol matching (HTTPS:// -> https://)
const preprocessInput = (input: string): string => {
    const protocolMatch = input.match(/^https?:\/\//i);
    if (protocolMatch) {
        return input.replace(protocolMatch[0], protocolMatch[0].toLowerCase());
    }
    return input;
};

const isValidServerAddress = (
    input: string,
    options: ValidationOptions = {}
): boolean => {
    try {
        const urlRegex = options.allowPort
            ? /^(https?:\/\/)?([^/:]+|\[?[a-fA-F0-9:]+\]?)(:\d+)?(\/.*)?$/
            : /^(https?:\/\/)?([^/:]+|\[?[a-fA-F0-9:]+\]?)(\/.*)?$/;

        input = preprocessInput(input);
        const match = input.match(urlRegex);
        if (!match) return false;

        const protocol = match[1];
        const host = match[2];
        const port = options.allowPort ? match[3] : null;
        const path = options.allowPort ? match[4] : match[3];

        if (options.requireHttps) {
            if (protocol && protocol !== 'https://') return false;
        } else if (protocol && !/^https?:\/\//.test(protocol)) return false;

        if (!HOST_REGEX.test(host)) return false;

        if (
            port &&
            (!PORT_REGEX.test(port) ||
                parseInt(port.slice(1)) < 1 ||
                parseInt(port.slice(1)) > 65535)
        )
            return false;

        if (path && !PATH_REGEX.test(path)) return false;

        return true;
    } catch (error) {
        return false;
    }
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
    isValidServerAddress,
    isValidPort,
    hasValidRuneChars,
    hasValidMacaroonChars,
    hasValidPairingPhraseCharsAndWordcount
};

export default ValidationUtils;
