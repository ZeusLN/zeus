import { action, observable } from 'mobx';
import EncryptedStorage from 'react-native-encrypted-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';

import SettingsStore from './SettingsStore';
import Order from '../models/Order';

export interface orderPaymentInfo {
    orderId: string;
    orderTotal: string;
    orderTip: string;
    exchangeRate: string;
    rate: number;
    type: string; // ln OR onchain
    tx: string; // txid OR payment request
}

export default class PosStore {
    @observable public openOrders: Array<Order> = [];
    @observable public paidOrders: Array<Order> = [];
    @observable public filteredOpenOrders: Array<Order> = [];
    @observable public filteredPaidOrders: Array<Order> = [];
    @observable public loading = false;
    @observable public error = false;

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    @action
    public updateSearch = (value: string) => {
        this.filteredOpenOrders = this.openOrders.filter(
            (item: any) =>
                item.getItemsList.includes(value) ||
                item.getItemsList.toLowerCase().includes(value)
        );
        this.filteredPaidOrders = this.paidOrders.filter(
            (item: any) =>
                item.getItemsList.includes(value) ||
                item.getItemsList.toLowerCase().includes(value)
        );
    };

    @action
    public recordPayment = ({
        orderId,
        orderTotal,
        orderTip,
        exchangeRate,
        rate,
        type,
        tx
    }: orderPaymentInfo) =>
        EncryptedStorage.setItem(
            `pos-${orderId}`,
            JSON.stringify({
                orderId,
                orderTotal,
                orderTip,
                exchangeRate,
                rate,
                type,
                tx
            })
        );

    @action
    public getOrders = async () => {
        const { squareAccessToken, squareLocationId, squareDevMode } =
            this.settingsStore.settings.pos;
        this.loading = true;
        this.error = false;
        const apiHost = squareDevMode
            ? 'https://connect.squareupsandbox.com'
            : 'https://connect.squareup.com';
        ReactNativeBlobUtil.fetch(
            'POST',
            `${apiHost}/v2/orders/search`,
            {
                Authorization: `Bearer ${squareAccessToken}`,
                'Content-Type': 'application/json'
            },
            JSON.stringify({
                location_ids: [squareLocationId]
            })
        )
            .then(async (response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    this.loading = false;
                    let orders = response
                        .json()
                        .orders.map((order: any) => new Order(order))
                        .filter((order: any) => {
                            return (
                                order.tenders &&
                                order.tenders[0] &&
                                order.tenders[0].note &&
                                (order.tenders[0].note
                                    .toLowerCase()
                                    .includes('zeus') ||
                                    order.tenders[0].note
                                        .toLowerCase()
                                        .includes('zues') ||
                                    order.tenders[0].note
                                        .toLowerCase()
                                        .includes('bitcoin') ||
                                    order.tenders[0].note
                                        .toLowerCase()
                                        .includes('btc'))
                            );
                        });

                    const enrichedOrders = await Promise.all(
                        orders.map(async (order: any) => {
                            const payment = await EncryptedStorage.getItem(
                                `pos-${order.id}`
                            );
                            if (payment) order.payment = JSON.parse(payment);
                            return order;
                        })
                    );

                    const openOrders = enrichedOrders.filter((order: any) => {
                        return !order.payment;
                    });
                    const paidOrders = enrichedOrders.filter((order: any) => {
                        return order.payment;
                    });

                    this.openOrders = openOrders;
                    this.filteredOpenOrders = openOrders;
                    this.paidOrders = paidOrders;
                    this.filteredPaidOrders = paidOrders;
                } else {
                    this.openOrders = [];
                    this.paidOrders = [];
                    this.loading = false;
                    this.error = true;
                }
            })
            .catch((err) => {
                console.error('POS get orders err', err);
                this.openOrders = [];
                this.paidOrders = [];
                this.loading = false;
            });
    };

    resetOrders = () => {
        this.openOrders = [];
        this.paidOrders = [];
        this.loading = false;
    };
}
