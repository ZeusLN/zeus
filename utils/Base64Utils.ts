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

    textToCharCodeBytes = (input: string) =>
        Uint8Array.from(input, (x) => x.charCodeAt(0));

    hexToBytes = (input: string) =>
        new Uint8Array(
            input.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
        );
    bytesToHex = (input: number[]) =>
        input.reduce(
            (memo: string, i: number) =>
                memo + ('0' + i.toString(16)).slice(-2),
            ''
        );

    bytesToUtf8 = (input: Uint8Array) => Buffer.from(input).toString('utf-8');

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

    hexStringToBin = (data: string) =>
        data
            .split('')
            .map((i) => parseInt(i, 16).toString(2).padStart(4, '0'))
            .join('');

    hexToAscii = (str1: string) => {
        const hex = str1.toString();
        let str = '';
        for (var n = 0; n < hex.length; n += 2) {
            str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
        }
        return str;
    };

    stringToHex = (str: string) => {
        const arr = [];
        for (let i = 0; i < str.length; i++) {
            arr[i] = ('0' + str.charCodeAt(i).toString(16)).slice(-2);
        }
        return arr.join('');
    };

    mfpIntToBytes = (mfpInt: number) => {
        // Convert the integer to hexadecimal string
        let hexString = mfpInt.toString(16);

        // Pad the string if necessary to ensure it has 8 characters
        while (hexString.length < 8) {
            hexString = '0' + hexString;
        }

        return this.reverseMfpBytes(hexString).toUpperCase();
    };

    reverseMfpBytes = (mfp: string) => {
        // must be 8 characters
        const byteArray = mfp.match(/.{2}/g) || [];
        return byteArray.reverse().join('');
    };

    isHex = (str: string) => {
        const hexRegex = /^[0-9A-Fa-f]+$/g;
        return hexRegex.test(str);
    };
}

const base64Utils = new Base64Utils();
export default base64Utils;
