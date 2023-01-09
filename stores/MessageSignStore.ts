import { action, observable } from 'mobx';
import BackendUtils from './../utils/BackendUtils';

interface VerificationRequest {
    msg: string;
    signature: string;
}

export default class MessageSignStore {
    @observable public loading = false;
    @observable public error = false;
    @observable public signature: string | null;
    @observable public verification: string | null;
    @observable public pubkey: string | null;
    @observable public valid: boolean | null;

    @action
    public reset() {
        this.signature = null;
        this.pubkey = null;
        this.valid = null;
        this.error = false;
    }

    @action
    public signMessage = (text: string) => {
        this.loading = true;

        BackendUtils.signMessage(text)
            .then((data: any) => {
                this.signature = data.zbase || data.signature;
                this.error = false;
            })
            .catch((error: any) => {
                this.error = error.toString();
                this.reset();
            })
            .finally(() => {
                this.loading = false;
            });
    };

    @action
    public verifyMessage = (data: VerificationRequest) => {
        this.loading = true;

        BackendUtils.verifyMessage({ msg: data.msg, signature: data.signature })
            .then((data: any) => {
                this.valid = data.valid || data.verified || false;
                this.pubkey = data.pubkey || data.publicKey;
                this.error = false;
            })
            .catch((error: any) => {
                this.error = error.toString();
            })
            .finally(() => {
                this.loading = false;
            });
    };
}
