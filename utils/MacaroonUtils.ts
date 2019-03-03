import { decode as atob } from 'base-64';

class MacaroonUtils {
    base64UrlToHex = (input: string) => {
        const raw = atob(this.base64UrlToBase64(input));
        let HEX = '';

        for (let i = 0; i < raw.length; i++) {
            const hexChar = raw.charCodeAt(i).toString(16);
            HEX += (hexChar.length === 2 ? hexChar : '0' + hexChar);
        }
        return HEX.toUpperCase();
    }

    base64UrlToBase64 = (input: string) => {
        // Replace non-url compatible chars with base64 standard chars
        input = input
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        // Pad out with standard base64 required padding characters
        var pad = input.length % 4;
        if(pad) {
          if(pad === 1) {
            throw new Error('InvalidLengthError: Input base64url string is the wrong length to determine padding');
          }
          input += new Array(5-pad).join('=');
        }

        return input;
    }
};

const macaroonUtils = new MacaroonUtils();
export default macaroonUtils;