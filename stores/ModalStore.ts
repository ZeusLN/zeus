import { action, observable } from 'mobx';

export default class ModalStore {
    @observable public showExternalLinkModal: boolean = false;
    @observable public showAndroidNfcModal: boolean = false;
    @observable public modalUrl: string;
    @observable public clipboardValue: string;
    @observable public onPress: () => void;

    /* External Link Modal */
    @action
    public toggleExternalLinkModal = (status: boolean) => {
        this.showExternalLinkModal = status;
    };

    @action
    public setUrl = (text: string) => {
        this.modalUrl = text;
    };

    @action
    public setAction = (action: any) => {
        this.onPress = action;
    };

    @action
    public setClipboardValue = (value: string) => {
        this.clipboardValue = value;
    };

    /* Android NFC Modal */
    @action
    public toggleAndroidNfcModal = (status: boolean) => {
        this.showAndroidNfcModal = status;
    };
}
