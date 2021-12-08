import { action, observable } from 'mobx';
import RESTUtils from './../utils/RESTUtils';
import Base64Utils from './../utils/Base64Utils';

export default class MessageSignStore {
    @observable public loading = false;
    @observable public error = false;
    @observable public signature: string | null;
    @observable public verification: string | null;

    @action
    public reset() {
        this.signature = null;
        this.verification = null;
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
                this.resetSignature();
            })
            .finally(() => {
                this.loading = false;
            });
    };

    @action
    public verifyMessage = (text: string) => {
        this.loading = true;
        const body = Base64Utils.btoa(text);

        RESTUtils.verifyMessage(body)
            .then((data: any) => {
                this.verification = data.signature;
                this.error = false;
            })
            .catch((error: any) => {
                this.error = error.toString();
                this.resetVerification();
            })
            .finally(() => {
                this.loading = false;
            });
    };
}
