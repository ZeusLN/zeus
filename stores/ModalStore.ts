import { action, observable } from 'mobx';

export default class ModalStore {
    @observable public showExternalLinkModal: boolean = false;
    @observable public showAndroidNfcModal: boolean = false;
    @observable public showInfoModal: boolean = false;
    @observable public modalUrl: string;
    @observable public clipboardValue: string;
    @observable public infoModalText: string | Array<string> | undefined;
    @observable public infoModalLink: string | undefined;
    @observable public infoModalNav: string | undefined;
    @observable public onPress: () => void;

    /* External Link Modal */
    @action
    public toggleExternalLinkModal = (status: boolean) => {
        this.showExternalLinkModal = status;
    };

    @action
    public toggleInfoModal = (
        text?: string | Array<string>,
        link?: string,
        nav?: string
    ) => {
        this.showInfoModal = text ? true : false;
        this.infoModalText = text;
        this.infoModalLink = link;
        this.infoModalNav = nav;
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

    @action
    public closeVisibleModalDialog = () => {
        if (this.showExternalLinkModal) {
            this.showExternalLinkModal = false;
            return true;
        }
        if (this.showAndroidNfcModal) {
            this.showAndroidNfcModal = false;
            return true;
        }
        if (this.showInfoModal) {
            this.showInfoModal = false;
            this.infoModalText = '';
            this.infoModalLink = '';
            this.infoModalNav = '';
            return true;
        }
        return false;
    };
}
