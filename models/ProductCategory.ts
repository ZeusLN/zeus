import { observable, computed } from 'mobx';
import BaseModel from './BaseModel';

export default class ProductCategory extends BaseModel {
    @observable public id: string;
    @observable public name: string;

    @computed public get model(): string {
        return 'ProductCategory';
    }
}
