import { action, observable } from 'mobx';
import RESTUtils from './../utils/RESTUtils';
import Base64Utils from './../utils/Base64Utils';

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
        const body = Base64Utils.btoa(text);

        RESTUtils.signMessage(body)
            .then((data: any) => {
                // TODO: properly decode signature
                this.signature = data.signature;
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
        const msg = Base64Utils.btoa(data.msg);

        RESTUtils.verifyMessage({ msg, signature: data.signature })
            .then((data: any) => {
                this.valid = data.valid;
                this.pubkey = data.pubkey;
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
}
