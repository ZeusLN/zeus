import MacaroonUtils from './MacaroonUtils';

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
            result.macaroon && MacaroonUtils.base64UrlToHex(result.macaroon);

        // prepend https by default
        host = 'https://' + host;

        const enableTor: boolean = host.includes('.onion');

        return { host, port, macaroonHex, enableTor };
    };

    processCLightningRestConnectUrl = (input: string) => {
        let host, port;
        const forceHttp = input.includes('c-lightning-rest://http://');
        const clrConnectionString = forceHttp
            ? input.replace('c-lightning-rest://http://', '')
            : input.split('c-lightning-rest://')[1];
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
            host =
                clrConnectionString && clrConnectionString.split(']:')[0] + ']';
            port =
                clrConnectionString &&
                clrConnectionString.split(']:')[1] &&
                clrConnectionString.split(']:')[1].split('?')[0];
        } else {
            host = clrConnectionString && clrConnectionString.split(':')[0];
            port =
                clrConnectionString &&
                clrConnectionString.split(':')[1] &&
                clrConnectionString.split(':')[1].split('?')[0];
        }
        const macaroonHex = result.macaroon;

        // prepend https by default
        host = host.includes('://')
            ? host
            : forceHttp
            ? 'http://' + host
            : 'https://' + host;

        const enableTor: boolean = host.includes('.onion');

        return {
            host,
            port,
            macaroonHex,
            enableTor,
            implementation: 'c-lightning-REST'
        };
    };
}

const connectionFormatUtils = new ConnectionFormatUtils();
export default connectionFormatUtils;
