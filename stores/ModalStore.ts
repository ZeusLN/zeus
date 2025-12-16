import { action, observable } from 'mobx';

import Storage from '../storage';

export default class ModalStore {
    @observable public showExternalLinkModal: boolean = false;
    @observable public showAndroidNfcModal: boolean = false;
    @observable public showInfoModal: boolean = false;
    @observable public showAlertModal: boolean = false;
    @observable public showShareModal: boolean = false;
    @observable public showNewChannelModal: boolean = false;
    @observable public showNWCPendingPaymentsModal: boolean = false;
    @observable public showRatingModal: boolean = false;
    @observable public nwcPendingPaymentsData?: {
        pendingEvents: any[];
        totalAmount: number;
    };
    @observable public modalUrl: string;
    @observable public clipboardValue: string;
    @observable public infoModalTitle: string | undefined;
    @observable public infoModalText: string | Array<string> | undefined;
    @observable public infoModalLink: string | undefined;
    @observable public infoModalAdditionalButtons?: Array<{
        title: string;
        callback?: () => void;
    }>;
    @observable public alertModalText: string | Array<string> | undefined;
    @observable public alertModalLink: string | undefined;
    @observable public alertModalNav: string | undefined;
    @observable public onShareQR?: () => void;
    @observable public onShareText?: () => void;
    @observable public onShareGiftLink?: () => void;
    @observable public onPress: () => void;

    /* External Link Modal */
    @action
    public toggleExternalLinkModal = (status: boolean) => {
        this.showExternalLinkModal = status;
    };

    @action
    public toggleInfoModal = ({
        title,
        text,
        link,
        buttons
    }: {
        title?: string;
        text?: string | Array<string>;
        link?: string;
        buttons?: Array<{ title: string; callback?: () => void }>;
    }) => {
        this.showInfoModal = title || text ? true : false; // Show if title or text exists
        this.infoModalTitle = title;
        this.infoModalText = text;
        this.infoModalLink = link;
        this.infoModalAdditionalButtons = buttons;
    };

    @action
    public toggleAlertModal = (status: boolean) => {
        this.showAlertModal = status;
    };

    @action
    public toggleShareModal = ({
        onShareQR,
        onShareText,
        onShareGiftLink
    }: {
        onShareQR?: () => void;
        onShareText?: () => void;
        onShareGiftLink?: () => void;
    }) => {
        this.showShareModal = onShareQR && onShareText ? true : false;
        this.onShareQR = onShareQR;
        this.onShareText = onShareText;
        this.onShareGiftLink = onShareGiftLink;
    };

    @action
    public toggleNewChannelModal = () => {
        this.showNewChannelModal = !this.showNewChannelModal;
    };

    @action
    public toggleNWCPendingPaymentsModal = ({
        pendingEvents,
        totalAmount
    }: {
        pendingEvents?: any[];
        totalAmount?: number;
    }) => {
        this.showNWCPendingPaymentsModal =
            pendingEvents && totalAmount !== undefined ? true : false;
        this.nwcPendingPaymentsData =
            pendingEvents && totalAmount !== undefined
                ? { pendingEvents, totalAmount }
                : undefined;
    };

    @action
    public toggleRatingModal = (status: boolean) => {
        this.showRatingModal = status;
    };

    @action
    public checkAndTriggerRatingModal = async () => {
        try {
            const KEY_FIRST_PAYMENT = 'hasTriggeredRatingModalOnFirstPayment';

            const hasTriggered = await Storage.getItem(KEY_FIRST_PAYMENT);

            if (hasTriggered === 'true') return;

            await Storage.setItem(KEY_FIRST_PAYMENT, 'true');

            this.toggleRatingModal(true);
        } catch (e) {
            console.log(e);
        }
    };

    @action
    public shareQR = () => {
        if (this.onShareQR) this.onShareQR();
    };
    public shareText = () => {
        if (this.onShareText) this.onShareText();
    };
    public shareGiftLink = () => {
        if (this.onShareGiftLink) this.onShareGiftLink();
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
            this.infoModalTitle = undefined;
            this.infoModalText = undefined;
            this.infoModalLink = undefined;
            this.infoModalAdditionalButtons = undefined;
            return true;
        }
        if (this.showShareModal) {
            this.showShareModal = false;
            this.onShareQR = undefined;
            this.onShareText = undefined;
            this.onShareGiftLink = undefined;
            return true;
        }
        if (this.showNewChannelModal) {
            this.showNewChannelModal = false;
        }
        if (this.showNWCPendingPaymentsModal) {
            this.showNWCPendingPaymentsModal = false;
            this.nwcPendingPaymentsData = undefined;
            return true;
        }
        if (this.showRatingModal) {
            this.showRatingModal = false;
            return true;
        }
        return false;
    };
}
