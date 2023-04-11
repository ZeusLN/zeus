import { action, observable } from 'mobx';

export default class ModalStore {
    @observable public showModal: boolean = false;
    @observable public modalUrl: string;
    @observable public clipboardValue: string;
    @observable public onPress: () => void;

    @action
    public toggleModal = (status: boolean) => {
        this.showModal = status;
    };

    @action
    public setUrl = (text: string) => {
        this.modalUrl = text;
    };

    @action
    public closeModal = () => {
        this.showModal = false;
    };

    @action
    public setAction = (action: any) => {
        this.onPress = action;
    };

    @action
    public setClipboardValue = (value: string) => {
        this.clipboardValue = value;
    };
}
