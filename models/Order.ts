import { computed } from 'mobx';

import moment from 'moment';

import BaseModel from './BaseModel';
import { localeString } from './../utils/LocaleUtils';

interface LineItem {
    name: string;
    quantity: number;
}

export default class Order extends BaseModel {
    updated_at: string;
    created_at: string;
    tax_money: {
        amount: number;
        currency: string;
    };
    total_money: {
        amount: number;
        currency: string;
    };
    line_items: Array<LineItem>;

    @computed public get model(): string {
        return localeString('general.order');
    }

    @computed public get getDisplayTime(): string {
        const updated = moment(this.updated_at).format('hh:mm a');
        const day = moment(this.created_at).format('ddd, MMM DD');
        return `${updated} | ${day}`;
    }

    @computed public get getItemCount(): number {
        return (this.line_items && this.line_items.length) || 0;
    }

    @computed public get getItemsList(): string {
        const itemCount = this.getItemCount;
        let itemsList = '';
        for (let i = 0; i < itemCount; i++) {
            const line_item: any = this.line_items[i];
            itemsList +=
                line_item.quantity == 1
                    ? line_item.name
                    : `${line_item.name} (x${line_item.quantity})`;
            if (i !== itemCount - 1) itemsList += ', ';
        }
        return itemsList;
    }

    @computed public get getTotalMoney(): string {
        return Number(this.total_money.amount / 100).toFixed(2);
    }

    @computed public get getTotalMoneyDisplay(): string {
        return `$${this.getTotalMoney}`;
    }

    @computed public get getTaxMoney(): string {
        return Number(
            ((this.tax_money && this.tax_money.amount) || 0) / 100
        ).toFixed(2);
    }

    @computed public get getTaxMoneyDisplay(): string {
        return `$${this.getTaxMoney}`;
    }
}
