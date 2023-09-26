class Base64Utils {
    encodeStringToBase64 = (input = '') =>
        Buffer.from(input).toString('base64');

    decodeBase64ToString = (input = '') =>
        Buffer.from(input, 'base64').toString('utf8');

    hexToBase64 = (str = '') => Buffer.from(str, 'hex').toString('base64');

    stringToUint8Array = (str: string) =>
        Uint8Array.from(str, (x) => x.charCodeAt(0));

    hexToUint8Array = (hexString: string) =>
        new Uint8Array(
            hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
        );

    bytesToHexString = (bytes: any) =>
        bytes.reduce(
            (memo: any, i: number) => memo + ('0' + i.toString(16)).slice(-2),
            ''
        );

    utf8ToHexString = (hexString: string) =>
        Buffer.from(hexString, 'utf8').toString('hex');

    base64ToHex = (base64String: string) =>
        Buffer.from(base64String, 'base64').toString('hex');

    // from https://coolaj86.com/articles/unicode-string-to-a-utf-8-typed-array-buffer-in-javascript/
    unicodeStringToUint8Array = (s: string) => {
        const escstr = encodeURIComponent(s);
        const binstr = escstr.replace(/%([0-9A-F]{2})/g, function (_, p1) {
            return String.fromCharCode(('0x' + p1) as any);
        });
        const ua = new Uint8Array(binstr.length);
        Array.prototype.forEach.call(binstr, function (ch, i) {
            ua[i] = ch.charCodeAt(0);
        });
        return ua;
    };
}

const base64Utils = new Base64Utils();
export default base64Utils;
