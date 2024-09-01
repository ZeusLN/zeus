import { observable, computed } from 'mobx';
import BaseModel from './BaseModel';

export enum PricedIn {
    Bitcoin = 'BTC',
    Sats = 'sats',
    Fiat = 'fiat'
}

export enum ProductStatus {
    Active = 'active',
    Inactive = 'inactive'
}

export default class Product extends BaseModel {
    @observable public id: string;
    @observable public name: string;
    @observable public sku: string;
    @observable public pricedIn: PricedIn;
    @observable public price: string;
    @observable public category: string;
    @observable public status: ProductStatus;

    @computed public get model(): string {
        return 'Product';
    }
}
