import { computed } from 'mobx';
import BaseModel from './BaseModel';
import RNFS from 'react-native-fs';

import { getPhoto } from '../utils/PhotoUtils';

export default class Contact extends BaseModel {
    id: string; // deprecated
    public contactId: string;
    public lnAddress: Array<string>;
    public bolt12Address: Array<string>;
    public bolt12Offer: Array<string>;
    public onchainAddress: Array<string>;
    public pubkey: Array<string>;
    public nip05: Array<string>;
    public nostrNpub: Array<string>;
    public name: string;
    public description: string;
    public photo: string | null;
    public banner: string | null;
    public isFavourite: boolean;

    @computed public get getContactId(): string {
        return this.contactId || this.id;
    }

    @computed public get isSingleLnAddress(): boolean {
        return (
            this.lnAddress &&
            this.lnAddress.length === 1 &&
            this.lnAddress[0] !== '' &&
            (!this.bolt12Address ||
                !this.bolt12Address[0] ||
                this.bolt12Address[0] === '') &&
            (!this.onchainAddress[0] || this.onchainAddress[0] === '') &&
            (!this.pubkey[0] || this.pubkey[0] === '') &&
            (!this.bolt12Offer ||
                !this.bolt12Offer[0] ||
                this.bolt12Offer[0] === '')
        );
    }

    @computed public get isSingleBolt12Address(): boolean {
        return (
            this.bolt12Address &&
            this.bolt12Address.length === 1 &&
            this.bolt12Address[0] !== '' &&
            (!this.lnAddress[0] || this.lnAddress[0] === '') &&
            (!this.onchainAddress[0] || this.onchainAddress[0] === '') &&
            (!this.pubkey[0] || this.pubkey[0] === '') &&
            (!this.bolt12Offer ||
                !this.bolt12Offer[0] ||
                this.bolt12Offer[0] === '')
        );
    }

    @computed public get isSingleBolt12Offer(): boolean {
        return (
            this.bolt12Offer &&
            this.bolt12Offer.length === 1 &&
            this.bolt12Offer[0] !== '' &&
            (!this.lnAddress[0] || this.lnAddress[0] === '') &&
            (!this.onchainAddress[0] || this.onchainAddress[0] === '') &&
            (!this.pubkey[0] || this.pubkey[0] === '') &&
            (!this.bolt12Address ||
                !this.bolt12Address[0] ||
                this.bolt12Address[0] === '')
        );
    }

    @computed public get isSingleOnchainAddress(): boolean {
        return (
            this.onchainAddress &&
            this.onchainAddress.length === 1 &&
            this.onchainAddress[0] !== '' &&
            (!this.lnAddress[0] || this.lnAddress[0] === '') &&
            (!this.bolt12Address ||
                !this.bolt12Address[0] ||
                this.bolt12Address[0] === '') &&
            (!this.pubkey[0] || this.pubkey[0] === '') &&
            (!this.bolt12Offer ||
                !this.bolt12Offer[0] ||
                this.bolt12Offer[0] === '')
        );
    }

    @computed public get isSinglePubkey(): boolean {
        return (
            this.pubkey &&
            this.pubkey.length === 1 &&
            this.pubkey[0] !== '' &&
            (!this.lnAddress[0] || this.lnAddress[0] === '') &&
            (!this.bolt12Address ||
                !this.bolt12Address[0] ||
                this.bolt12Address[0] === '') &&
            (!this.onchainAddress[0] || this.onchainAddress[0] === '') &&
            (!this.bolt12Offer ||
                !this.bolt12Offer[0] ||
                this.bolt12Offer[0] === '')
        );
    }

    @computed public get hasLnAddress(): boolean {
        return this.lnAddress?.length > 0 && this.lnAddress[0] !== '';
    }

    @computed public get hasBolt12Address(): boolean {
        return this.bolt12Address?.length > 0 && this.bolt12Address[0] !== '';
    }

    @computed public get hasBolt12Offer(): boolean {
        return this.bolt12Offer?.length > 0 && this.bolt12Offer[0] !== '';
    }

    @computed public get hasOnchainAddress(): boolean {
        return this.onchainAddress?.length > 0 && this.onchainAddress[0] !== '';
    }

    @computed public get hasPubkey(): boolean {
        return this.pubkey?.length > 0 && this.pubkey[0] !== '';
    }

    @computed public get hasMultiplePayableAddresses(): boolean {
        let count = 0;
        this.lnAddress.forEach((address) => {
            if (address && address !== '') count++;
        });
        this.bolt12Address?.forEach((address) => {
            if (address && address !== '') count++;
        });
        this.bolt12Offer?.forEach((address) => {
            if (address && address !== '') count++;
        });
        this.onchainAddress.forEach((address) => {
            if (address && address !== '') count++;
        });
        this.pubkey.forEach((address) => {
            if (address && address !== '') count++;
        });

        return count > 1 ? true : false;
    }

    @computed public get hasNip05(): boolean {
        return this.nip05?.length > 0 && this.nip05[0] !== '';
    }

    @computed public get hasNpub(): boolean {
        return this.nostrNpub?.length > 0 && this.nostrNpub[0] !== '';
    }

    @computed public get getPhoto(): string {
        return getPhoto(this.photo || '');
    }

    @computed public get getBanner(): string {
        if (this.banner?.includes('rnfs://')) {
            const fileName = this.banner.replace('rnfs://', '');
            return `file://${RNFS.DocumentDirectoryPath}/${fileName}`;
        }
        return this.banner || '';
    }
}
