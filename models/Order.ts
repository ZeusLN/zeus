import { computed } from 'mobx';
import moment from 'moment';

import BaseModel from './BaseModel';
import { localeString } from '../utils/LocaleUtils';
import { orderPaymentInfo } from '../stores/PosStore';
import { fiatStore } from '../stores/Stores';

interface BasePriceMoney {
    amount: number;
    sats?: number;
}
export interface LineItem {
    name: string;
    quantity: number;
    base_price_money: BasePriceMoney;
    taxPercentage?: string;
}

export default class Order extends BaseModel {
    id: string;
    updated_at: string;
    created_at: string;
    total_tax_money: {
        amount: number;
        currency: string;
    };
    total_money: {
        amount: number;
        currency: string;
        sats?: number;
    };
    line_items: Array<LineItem>;
    payment?: orderPaymentInfo;

    @computed public get model(): string {
        return localeString('general.order');
    }

    @computed public get getDisplayTime(): string {
        const date = moment(this.updated_at || this.created_at);
        const year =
            date.year() !== moment().year() ? `, '${date.format('YY')}` : '';
        return `${date.format('hh:mm a | ddd, MMM DD')}${year}`;
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

    @computed public get autoGratuity(): string {
        let autoGratuity = '';
        const itemCount = this.getItemCount;
        for (let i = 0; i < itemCount; i++) {
            const line_item: any = this.line_items[i];
            if (line_item.name.toLowerCase().includes('gratuity')) {
                autoGratuity = Number(
                    line_item.base_price_money.amount / 100
                ).toFixed(2);
            }
        }
        return autoGratuity;
    }

    @computed public get getTotalMoney(): string {
        return Number(this.total_money.amount / 100).toFixed(2);
    }

    @computed public get getTotalMoneyDisplay(): string {
        return fiatStore.formatAmountForDisplay(this.getTotalMoney);
    }

    @computed public get getTaxMoney(): string {
        return Number(
            ((this.total_tax_money && this.total_tax_money.amount) || 0) / 100
        ).toFixed(2);
    }

    @computed public get getTaxMoneyDisplay(): string {
        return fiatStore.formatAmountForDisplay(this.getTaxMoney);
    }
}
