import { computed } from 'mobx';
import BaseModel from './BaseModel';

export default class Offer extends BaseModel {
    // bolt12
    public bolt12: string;
    public bolt12_unsigned: string;
    public offer_id: string;
    public single_use?: boolean;
    public used?: boolean;
    public active?: boolean;
    public label?: string;

    @computed public get model(): string {
        return 'Offer';
    }

    @computed public get isPaid(): boolean {
        return this.used;
    }
}
