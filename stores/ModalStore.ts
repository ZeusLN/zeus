import { action, observable } from 'mobx';

interface InfoModalParams {
    text?: string | Array<string>;
    link?: string;
    buttons?: Array<{ title: string; callback?: () => void }>;
    onDismiss?: () => void;
}

export default class ModalStore {
    @observable public showExternalLinkModal: boolean = false;
    @observable public showAndroidNfcModal: boolean = false;
    @observable public showInfoModal: boolean = false;
    @observable public showAlertModal: boolean = false;
    @observable public modalUrl: string;
    @observable public clipboardValue: string;
    @observable public infoModalText: string | Array<string> | undefined;
    @observable public infoModalLink: string | undefined;
    @observable public infoModalAdditionalButtons?: Array<{
        title: string;
        callback?: () => void;
    }>;
    @observable public alertModalText: string | Array<string> | undefined;
    @observable public alertModalLink: string | undefined;
    @observable public alertModalNav: string | undefined;
    @observable public onPress: () => void;
    @observable public onDismiss: (() => void) | undefined;

    /* External Link Modal */
    @action
    public toggleExternalLinkModal = (status: boolean) => {
        this.showExternalLinkModal = status;
    };

    @action
    public toggleInfoModal = (params?: InfoModalParams) => {
        this.showInfoModal = !!params?.text;
        this.infoModalText = params?.text;
        this.infoModalLink = params?.link;
        this.infoModalAdditionalButtons = params?.buttons;
        this.onDismiss = params?.onDismiss;
        if (!params?.text && params?.onDismiss) params.onDismiss();
    };

    @action
    public toggleAlertModal = (status: boolean) => {
        this.showAlertModal = status;
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
            if (this.onDismiss) this.onDismiss();
            this.showInfoModal = false;
            this.infoModalText = '';
            this.infoModalLink = '';
            this.onDismiss = undefined;
            this.infoModalAdditionalButtons = undefined;
            return true;
        }
        return false;
    };
}
