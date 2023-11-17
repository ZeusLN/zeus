import { action, observable } from 'mobx';
import EncryptedStorage from 'react-native-encrypted-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import BigNumber from 'bignumber.js';

import { SATS_PER_BTC } from './UnitsStore';
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

const POS_HIDDEN_KEY = 'pos-hidden';

export default class PosStore {
    @observable public openOrders: Array<Order> = [];
    @observable public paidOrders: Array<Order> = [];
    @observable public filteredOpenOrders: Array<Order> = [];
    @observable public filteredPaidOrders: Array<Order> = [];
    // recon
    @observable public completedOrders: Array<Order> = [];
    @observable public reconTotal: string = '0.00';
    @observable public reconTax: string = '0.00';
    @observable public reconTips: string = '0.00';
    @observable public reconExport: string = '';
    //
    @observable public loading = false;
    @observable public error = false;

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    @action
    public hideOrder = async (orderId: string) => {
        const hiddenOrdersItem = await EncryptedStorage.getItem(POS_HIDDEN_KEY);
        const hiddenOrders = JSON.parse(hiddenOrdersItem || '[]');
        hiddenOrders.push(orderId);
        await EncryptedStorage.setItem(
            POS_HIDDEN_KEY,
            JSON.stringify(hiddenOrders)
        );
    };

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
                                        .includes('btc') ||
                                    order.tenders[0].note
                                        .toLowerCase()
                                        .includes('bit coin'))
                            );
                        });

                    // fetch hidden orders - orders customers couldn't pay
                    const hiddenOrdersItem = await EncryptedStorage.getItem(
                        POS_HIDDEN_KEY
                    );
                    const hiddenOrders = JSON.parse(hiddenOrdersItem || '[]');

                    const enrichedOrders = await Promise.all(
                        orders.map(async (order: any) => {
                            const payment = await EncryptedStorage.getItem(
                                `pos-${order.id}`
                            );
                            // mark order if hidden
                            if (hiddenOrders.includes(order.id)) {
                                order.hidden = true;
                            }
                            if (payment) order.payment = JSON.parse(payment);
                            return order;
                        })
                    );

                    const openOrders = enrichedOrders.filter((order: any) => {
                        return !order.payment && !order.hidden;
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

    @action
    public getOrdersHistorical = async (hours = 24) => {
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
                limit: 10000,
                location_ids: [squareLocationId],
                query: {
                    filter: {
                        date_time_filter: {
                            created_at: {
                                start_at: new Date(
                                    Date.now() - hours * 60 * 60 * 1000
                                ).toISOString(),
                                end_at: new Date().toISOString()
                            }
                        },
                        state_filter: {
                            states: ['COMPLETED']
                        }
                    }
                },
                sort: {
                    sort_field: 'CREATED_AT',
                    sort_order: 'DESC'
                }
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
                                        .includes('btc') ||
                                    order.tenders[0].note
                                        .toLowerCase()
                                        .includes('bit coin'))
                            );
                        });

                    let total = 0;
                    let tax = 0;
                    let tips = 0;
                    let exportString =
                        'orderId, totalSats, tipSats, rateFull, rateNumerical, type, tx\n';

                    // fetch hidden orders - orders customers couldn't pay
                    const hiddenOrdersItem = await EncryptedStorage.getItem(
                        POS_HIDDEN_KEY
                    );
                    const hiddenOrders = JSON.parse(hiddenOrdersItem || '[]');

                    const enrichedOrders = await Promise.all(
                        orders.map(async (order: any) => {
                            const payment = await EncryptedStorage.getItem(
                                `pos-${order.id}`
                            );
                            let tip;
                            // mark order if hidden
                            if (hiddenOrders.includes(order.id)) {
                                order.hidden = true;
                            }
                            if (payment) {
                                order.payment = JSON.parse(payment);
                                const {
                                    orderId,
                                    orderTotal,
                                    orderTip,
                                    exchangeRate,
                                    rate,
                                    type,
                                    tx
                                } = order.payment;
                                tip = new BigNumber(orderTip)
                                    .multipliedBy(rate)
                                    .dividedBy(SATS_PER_BTC)
                                    .toFixed(2);

                                exportString += `${orderId}, ${orderTotal}, ${orderTip}, ${exchangeRate}, ${rate}, ${type}, ${tx}\n`;
                            }

                            // tally totals
                            total +=
                                Number(order.getTotalMoney) +
                                Number(order.getTaxMoney);
                            tax += Number(order.getTaxMoney);
                            tips += tip
                                ? Number(tip)
                                : order.autoGratuity
                                ? Number(order.autoGratuity)
                                : 0;
                            return order;
                        })
                    );

                    this.completedOrders = enrichedOrders;
                    this.reconTotal = total.toFixed(2);
                    this.reconTax = tax.toFixed(2);
                    this.reconTips = tips.toFixed(2);
                    this.reconExport = exportString;
                } else {
                    this.completedOrders = [];
                    this.loading = false;
                    this.error = true;
                }
            })
            .catch((err) => {
                console.error('POS get historical orders err', err);
                this.completedOrders = [];
                this.loading = false;
            });
    };

    resetOrders = () => {
        this.openOrders = [];
        this.paidOrders = [];
        this.loading = false;
    };
}
