import MacaroonUtils from './MacaroonUtils';

class LndConnectUtils {
    processLndConnectUrl = (input: string) => {
        let host, port, macaroonHex;
        const lndconnect = input.split('lndconnect://')[1];
        const macaroon = input.split('&macaroon=')[1];

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
        macaroonHex = macaroon && MacaroonUtils.base64UrlToHex(macaroon);

        return { host, port, macaroonHex };
    };
}

const lndConnectUtils = new LndConnectUtils();
export default lndConnectUtils;
