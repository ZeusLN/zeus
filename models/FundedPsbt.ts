import Base64Utils from '../utils/Base64Utils';

export default class FundedPsbt {
    formatted: string;

    constructor(data: any) {
        if (typeof data === 'object') {
            this.formatted = Base64Utils.bytesToBase64(data);
        }
        if (typeof data === 'string') {
            this.formatted = data;
        }
    }

    getFormatted() {
        return this.formatted;
    }
}
