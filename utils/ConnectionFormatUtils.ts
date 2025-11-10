import Base64Utils from './Base64Utils';
import { Implementations } from '../stores/SettingsStore';

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

        // prepend https by default
        host = 'https://' + host;

        const enableTor: boolean = host.includes('.onion');

        return { host, port, macaroonHex, enableTor };
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
        // certs parameter is available in result.certs but not currently used
        // It contains Base64-encoded client key, client cert, and CA cert

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
            implementation
        };
    };
}

const connectionFormatUtils = new ConnectionFormatUtils();
export default connectionFormatUtils;
