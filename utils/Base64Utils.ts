const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
class Base64Utils {
    btoa = (input: string = '') => {
        let str = input;
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

    hexToBase64 = (str: string = '') =>
        Buffer.from(str, 'hex').toString('base64');
}

const base64Utils = new Base64Utils();
export default base64Utils;
