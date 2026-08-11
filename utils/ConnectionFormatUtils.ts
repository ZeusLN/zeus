import Base64Utils from './Base64Utils';
import { Implementations } from '../stores/SettingsStore';

// Extract the base64-DER body of every CERTIFICATE block in a PEM bundle
const pemBundleToPinnedCerts = (bundle: string): string[] | undefined => {
    const blocks = bundle.match(
        /-----BEGIN CERTIFICATE-----[^-]+-----END CERTIFICATE-----/g
    );
    if (!blocks || blocks.length === 0) return undefined;
    return blocks.map((block) =>
        block
            .replace(/-----BEGIN CERTIFICATE-----/, '')
            .replace(/-----END CERTIFICATE-----/, '')
            .replace(/\s+/g, '')
    );
};

// Normalize connection-string certificate material (lndconnect cert=,
// clnrest certs=) into base64-DER pins. Inputs are base64(url) and may
// carry either raw DER or PEM-armored certificates.
const certsParamToPinnedCerts = (
    param: string,
    isBase64Url: boolean
): string[] | undefined => {
    let b64: string;
    try {
        b64 = isBase64Url ? Base64Utils.base64UrlToBase64(param) : param;
    } catch (e) {
        // malformed cert material: no pins — the strict-verification
        // default makes the failure loud at connect time
        return undefined;
    }
    const decoded = Base64Utils.base64ToUtf8(b64);
    if (decoded.includes('-----BEGIN CERTIFICATE-----')) {
        return pemBundleToPinnedCerts(decoded);
    }
    // PEM bundles without a certificate block carry nothing pinnable;
    // otherwise assume raw DER (lndconnect)
    return isBase64Url ? [b64] : undefined;
};

class ConnectionFormatUtils {
    processLndConnectUrl = (input: string) => {
        let host, port;
        const lndconnect = input.split('lndconnect://')[1];
        const params = input.split('?')[1];

        const result: any = {};
        if (params) {
            params.split('&').forEach(function (part) {
                const item = part.split('=');
                result[item[0]] = decodeURIComponent(item[1]);
            });
        }

        // is IPv6
        if (input.includes('[')) {
            host = lndconnect && lndconnect.split(']:')[0] + ']';
            port =
                lndconnect &&
                lndconnect.split(']:')[1] &&
                lndconnect.split(']:')[1].split('?')[0];
        } else {
            host = lndconnect && lndconnect.split(':')[0];
            port =
                lndconnect &&
                lndconnect.split(':')[1] &&
                lndconnect.split(':')[1].split('?')[0];
        }
        const macaroonHex =
            result.macaroon && Base64Utils.base64UrlToHex(result.macaroon);

        // cert= carries the node's TLS certificate — retain it for
        // certificate pinning instead of silently dropping it
        const pinnedCerts = result.cert
            ? certsParamToPinnedCerts(result.cert, true)
            : undefined;

        // prepend https by default
        host = 'https://' + host;

        const enableTor: boolean = host.includes('.onion');

        return { host, port, macaroonHex, enableTor, pinnedCerts };
    };

    processLncUrl = (input: string) => {
        let mailboxServer, customMailboxServer;
        const encodedParams = input.split(
            'https://terminal.lightning.engineering#/connect/pair/'
        )[1];
        const decodedParams = Base64Utils.base64ToUtf8(encodedParams);
        const [pairingPhrase, server] = decodedParams.split('||');

        if (
            server === 'mailbox.terminal.lightning.today:443' ||
            server === 'lnc.zeusln.app:443'
        ) {
            mailboxServer = server;
        } else {
            mailboxServer = 'custom-defined';
            customMailboxServer = server;
        }

        return { pairingPhrase, mailboxServer, customMailboxServer };
    };

    processCLNRestConnectUrl = (input: string) => {
        let host: string = '';
        let port: string = '';
        let protocol = 'https'; // default protocol
        let clrConnectionString: string | undefined;

        // Check for new format: clnrest+<protocol>://
        if (input.includes('clnrest+')) {
            // Extract protocol from clnrest+<protocol>://
            const protocolMatch = input.match(/clnrest\+(\w+):\/\//);
            if (protocolMatch && protocolMatch[1]) {
                protocol = protocolMatch[1]; // http or https
            }
            // Extract connection string after clnrest+<protocol>://
            clrConnectionString = input.split(/clnrest\+\w+:\/\//)[1];
        } else if (input.includes('clnrest://')) {
            // Legacy format: clnrest://
            const forceHttp = input.includes('clnrest://http://');
            protocol = forceHttp ? 'http' : 'https';
            clrConnectionString = forceHttp
                ? input.replace('clnrest://http://', '')
                : input.split('clnrest://')[1];
        } else {
            // Fallback: shouldn't reach here if called correctly
            clrConnectionString = input;
        }

        const params = input.split('?')[1];

        const result: any = {};
        if (params) {
            params.split('&').forEach(function (part) {
                // split on only the first = sign
                const item = part.split(/=(.*)/s);
                result[item[0]] = decodeURIComponent(item[1]);
            });
        }

        // Extract host and port from connection string
        if (clrConnectionString) {
            // Remove query parameters from connection string
            const connectionPart = clrConnectionString.split('?')[0];

            // is IPv6
            if (connectionPart.includes('[')) {
                host = connectionPart.split(']:')[0] + ']';
                const portPart = connectionPart.split(']:')[1];
                port = portPart ? portPart.split('?')[0] : '';
            } else {
                host = connectionPart.split(':')[0] || '';
                const portPart = connectionPart.split(':')[1];
                port = portPart ? portPart.split('?')[0] : '';
            }
        }

        const rune = result.rune;
        // certs= carries a Base64-encoded PEM bundle (client key, client
        // cert, CA cert) — extract the certificates for TLS pinning
        const pinnedCerts = result.certs
            ? certsParamToPinnedCerts(result.certs, false)
            : undefined;

        // Build host with protocol
        if (host) {
            host = host.includes('://') ? host : `${protocol}://${host}`;
        }

        const enableTor: boolean = host ? host.includes('.onion') : false;

        const implementation: Implementations = 'cln-rest';

        return {
            host,
            port,
            rune,
            enableTor,
            implementation,
            pinnedCerts
        };
    };
}

const connectionFormatUtils = new ConnectionFormatUtils();
export default connectionFormatUtils;
