class Base64Utils {
    encodeStringToBase64 = (input = '') =>
        Buffer.from(input).toString('base64');

    decodeBase64ToString = (input = '') =>
        Buffer.from(input, 'base64').toString('utf8');

    base64ToBytes = (base64String: string) =>
        Uint8Array.from(Buffer.from(base64String, 'base64'));
    bytesToBase64 = (bytes: Uint8Array) =>
        Buffer.from(bytes).toString('base64');

    hexToBase64 = (hexString = '') =>
        Buffer.from(hexString, 'hex').toString('base64');

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

    base64UrlToHex = (input: string) =>
        Buffer.from(this.base64UrlToBase64(input), 'base64').toString('hex');

    base64UrlToBase64 = (input: string) => {
        // Replace non-url compatible chars with base64 standard chars
        input = input.replace(/-/g, '+').replace(/_/g, '/');

        // Pad out with standard base64 required padding characters
        const pad = input.length % 4;
        if (pad) {
            if (pad === 1) {
                throw new Error(
                    'InvalidLengthError: Input base64url string is the wrong length to determine padding'
                );
            }
            input += new Array(5 - pad).join('=');
        }

        return input;
    };
}

const base64Utils = new Base64Utils();
export default base64Utils;
