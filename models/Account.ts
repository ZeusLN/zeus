import { computed } from 'mobx';

import BaseModel from './BaseModel';
import Base64Utils from '../utils/Base64Utils';

export default class Account extends BaseModel {
    name: string;
    master_key_fingerprint?: string;

    @computed public get XFP(): string | undefined {
        if (this.master_key_fingerprint) {
            return Base64Utils.reverseMfpBytes(
                Base64Utils.base64ToHex(this.master_key_fingerprint)
            ).toUpperCase();
        }
        return undefined;
    }
}
