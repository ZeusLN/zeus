class Base64Utils {
    utf8ToBase64 = (input = '') => Buffer.from(input).toString('base64');
    base64ToUtf8 = (input = '') =>
        Buffer.from(input, 'base64').toString('utf8');

    base64ToBytes = (input: string) =>
        Uint8Array.from(Buffer.from(input, 'base64'));
    bytesToBase64 = (input: Uint8Array) =>
        Buffer.from(input).toString('base64');

    hexToBase64 = (input = '') => Buffer.from(input, 'hex').toString('base64');
    base64ToHex = (input: string) =>
        Buffer.from(input, 'base64').toString('hex');

    // TODO: rename to better describe the input
    stringToUint8Array = (input: string) =>
        Uint8Array.from(input, (x) => x.charCodeAt(0));

    hexToBytes = (input: string) =>
        new Uint8Array(
            input.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
        );
    bytesToHex = (input: any) =>
        input.reduce(
            (memo: any, i: number) => memo + ('0' + i.toString(16)).slice(-2),
            ''
        );

    utf8ToHex = (input: string) => Buffer.from(input, 'utf8').toString('hex');

    base64UrlToHex = (input: string) =>
        Buffer.from(this.base64UrlToBase64(input), 'base64').toString('hex');

    utf8ToBytes = (input: string) =>
        Uint8Array.from(Buffer.from(input, 'utf-8'));

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
