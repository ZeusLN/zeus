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
    public cashuPubkey: Array<string>;
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

    private isAddressArrayEmpty(addresses: Array<string> | undefined): boolean {
        return !addresses || addresses.length === 0 || addresses[0] === '';
    }

    private isAddressArraySingle(
        addresses: Array<string> | undefined
    ): boolean {
        return Boolean(
            addresses &&
                addresses.length === 1 &&
                addresses[0] &&
                addresses[0] !== ''
        );
    }

    private getActiveAddressTypes(): string[] {
        const activeTypes: string[] = [];

        if (!this.isAddressArrayEmpty(this.lnAddress))
            activeTypes.push('lnAddress');
        if (!this.isAddressArrayEmpty(this.bolt12Address))
            activeTypes.push('bolt12Address');
        if (!this.isAddressArrayEmpty(this.bolt12Offer))
            activeTypes.push('bolt12Offer');
        if (!this.isAddressArrayEmpty(this.onchainAddress))
            activeTypes.push('onchainAddress');
        if (!this.isAddressArrayEmpty(this.pubkey)) activeTypes.push('pubkey');
        if (!this.isAddressArrayEmpty(this.cashuPubkey))
            activeTypes.push('cashuPubkey');

        return activeTypes;
    }

    private isSingleAddressType(targetType: string): boolean {
        const activeTypes = this.getActiveAddressTypes();
        return activeTypes.length === 1 && activeTypes[0] === targetType;
    }

    @computed public get isSingleLnAddress(): boolean {
        return (
            this.isAddressArraySingle(this.lnAddress) &&
            this.isSingleAddressType('lnAddress')
        );
    }

    @computed public get isSingleBolt12Address(): boolean {
        return (
            this.isAddressArraySingle(this.bolt12Address) &&
            this.isSingleAddressType('bolt12Address')
        );
    }

    @computed public get isSingleBolt12Offer(): boolean {
        return (
            this.isAddressArraySingle(this.bolt12Offer) &&
            this.isSingleAddressType('bolt12Offer')
        );
    }

    @computed public get isSingleOnchainAddress(): boolean {
        return (
            this.isAddressArraySingle(this.onchainAddress) &&
            this.isSingleAddressType('onchainAddress')
        );
    }

    @computed public get isSinglePubkey(): boolean {
        return (
            this.isAddressArraySingle(this.pubkey) &&
            this.isSingleAddressType('pubkey')
        );
    }

    @computed public get isSingleCashuPubkey(): boolean {
        return (
            this.isAddressArraySingle(this.cashuPubkey) &&
            this.isSingleAddressType('cashuPubkey')
        );
    }

    @computed public get hasLnAddress(): boolean {
        return !this.isAddressArrayEmpty(this.lnAddress);
    }

    @computed public get hasBolt12Address(): boolean {
        return !this.isAddressArrayEmpty(this.bolt12Address);
    }

    @computed public get hasBolt12Offer(): boolean {
        return !this.isAddressArrayEmpty(this.bolt12Offer);
    }

    @computed public get hasOnchainAddress(): boolean {
        return !this.isAddressArrayEmpty(this.onchainAddress);
    }

    @computed public get hasPubkey(): boolean {
        return !this.isAddressArrayEmpty(this.pubkey);
    }

    @computed public get hasCashuPubkey(): boolean {
        return !this.isAddressArrayEmpty(this.cashuPubkey);
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
