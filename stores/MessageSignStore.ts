import { action, observable } from 'mobx';
import RESTUtils from './../utils/RESTUtils';
import Base64Utils from './../utils/Base64Utils';
import SignMessage from './../views/Settings/SignMessage';

export default class MessageSignStore {
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
    @observable public signature: string | null;

    resetSignature() {
        this.signature = null;
        this.error = false;
    }

    @action
    public signMessage = (text: string) => {
        this.loading = true;
        const body = Base64Utils.btoa(text);
        console.log("text, body ", text, body);

        RESTUtils.signMessage(body)
            .then((data: any) => {
                // TODO: properly decode signature
                this.signature = data.signature;
                this.error = false;
            })
            .catch((error: any) => {
                this.error = error.toString();
                this.resetSignature;
            })
            .finally(() => {
                this.loading = false;
            });
    };
}
