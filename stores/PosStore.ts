import { action, observable } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';

import SettingsStore from './SettingsStore';
import Order from '../models/Order';

interface makePaymentRequest {
    orderId: string;
    orderAmount: number;
    orderTip: number;
}

const genHex = (size: number) =>
    [...Array(size)]
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join('');
const genIdemptotencyKey = () =>
    `${genHex(8)}-${genHex(4)}-${genHex(4)}-${genHex(4)}-${genHex(12)}}`;

export default class PosStore {
    @observable public orders: Array<Order> = [];
    @observable public filteredOrders: Array<Order> = [];
    @observable public loading = false;
    @observable public error = false;

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    @action
    public updateSearch = (value: string) => {
        this.filteredOrders = this.orders.filter(
            (item: any) =>
                item.getItemsList.includes(value) ||
                item.getItemsList.toLowerCase().includes(value)
        );
    };

    @action
    public makePayment = ({
        orderId,
        orderAmount,
        orderTip
    }: makePaymentRequest) => {
        const { squareAccessToken, squareLocationId } =
            this.settingsStore.settings.pos;
        const fiat: string = this.settingsStore.settings.fiat || 'USD';
        this.loading = true;
        this.error = false;
        ReactNativeBlobUtil.fetch(
            'POST',
            // DEV -> 'https://connect.squareupsandbox.com/v2/payments',
            'https://connect.squareup.com/v2/payments',
            {
                Authorization: `Bearer ${squareAccessToken}`,
                'Content-Type': 'application/json'
            },
            JSON.stringify({
                location_ids: [squareLocationId],
                amount_money: {
                    amount: orderAmount,
                    currency: fiat
                },
                idempotency_key: genIdemptotencyKey(),
                source_id: 'EXTERNAL',
                external_details: {
                    source: 'ZEUS',
                    type: 'CRYPTO'
                },
                order_id: orderId,
                tip_money: {
                    currency: fiat,
                    amount: orderTip
                }
            })
        )
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    this.loading = false;
                } else {
                    this.loading = false;
                    this.error = true;
                }
            })
            .catch((err) => {
                console.error('POS make payment err', err);
                this.loading = false;
            });
    };

    @action
    public getOrders = (states = ['OPEN']) => {
        const { squareAccessToken, squareLocationId } =
            this.settingsStore.settings.pos;
        this.loading = true;
        this.error = false;
        this.orders = [];
        ReactNativeBlobUtil.fetch(
            'POST',
            // DEV -> 'https://connect.squareupsandbox.com/v2/orders/search'
            'https://connect.squareup.com/v2/orders/search',
            {
                Authorization: `Bearer ${squareAccessToken}`,
                'Content-Type': 'application/json'
            },
            JSON.stringify({
                location_ids: [squareLocationId],
                query: {
                    filter: {
                        state_filter: {
                            states
                        }
                    }
                }
            })
        )
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    this.loading = false;
                    const orders = response
                        .json()
                        .orders.map((order: any) => new Order(order));
                    this.orders = orders;
                    this.filteredOrders = orders;
                } else {
                    this.orders = [];
                    this.loading = false;
                    this.error = true;
                }
            })
            .catch((err) => {
                console.error('POS get orders err', err);
                this.orders = [];
                this.loading = false;
            });
    };

    resetOrders = () => {
        this.orders = [];
        this.loading = false;
    };
}
