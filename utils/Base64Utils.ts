const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
class Base64Utils {
    btoa = (input = '') => {
        const str = input;
        let output = '';

        for (
            let block = 0, charCode, i = 0, map = chars;
            str.charAt(i | 0) || ((map = '='), i % 1);
            output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
        ) {
            charCode = str.charCodeAt((i += 3 / 4));

            if (charCode > 0xff) {
                throw new Error(
                    "'btoa' failed: The string to be encoded contains characters outside of the Latin1 range."
                );
            }

            block = (block << 8) | charCode;
        }

        return output;
    };

    atob = (input = '') => {
        const str = input.replace(/=+$/, '');
        let output = '';

        if (str.length % 4 == 1) {
            throw new Error(
                "'atob' failed: The string to be decoded is not correctly encoded."
            );
        }
        for (
            let bc = 0, bs = 0, buffer, i = 0;
            (buffer = str.charAt(i++));
            ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
                ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
                : 0
        ) {
            buffer = chars.indexOf(buffer);
        }

        return output;
    };

    hexStringToBin = (data) => data.split('').map(i => parseInt(i, 16).toString(2).padStart(4, '0')).join('');

    byteToBase64 = (buffer: Uint8Array) => {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return this.btoa(binary);
    };

    hexToBase64 = (str = '') => this.byteToBase64(this.hexStringToByte(str));

    hexToAscii = (str1: string) => {
        const hex = str1.toString();
        let str = '';
        for (var n = 0; n < hex.length; n += 2) {
            str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
        }
        return str;
    };

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

    stringToHex = (str: string) => {
        const arr = [];
        for (let i = 0; i < str.length; i++) {
            arr[i] = ('0' + str.charCodeAt(i).toString(16)).slice(-2);
        }
        return arr.join('');
    };

    reverseMfpBytes = (mfp: string) => {
        // must be 8 characters
        const byteArray = mfp.match(/.{2}/g);
        return byteArray.reverse().join('');
    };
}

const base64Utils = new Base64Utils();
export default base64Utils;
