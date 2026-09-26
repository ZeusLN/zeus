import { action, observable, runInAction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import BigNumber from 'bignumber.js';
import { v4 as uuidv4 } from 'uuid';

import FiatStore from './FiatStore';
import SettingsStore, { PosEnabled } from './SettingsStore';
import UnitsStore from './UnitsStore';

import Order from '../models/Order';

import { SATS_PER_BTC } from '../utils/UnitsUtils';
import { calculateTaxSats } from '../utils/PosUtils';
import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';

import Storage from '../storage';

export interface orderPaymentInfo {
    orderId: string;
    orderTotal: string;
    orderTip: string;
    exchangeRate: string;
    rate: number;
    type: string; // ln OR onchain
    tx: string; // txid OR payment request
    preimage?: string;
}

export interface orderInvoiceInfo {
    orderId: string;
    payment_request: string;
    rHash: string;
    exchangeRate: string;
    amount: string;
    tip: string;
    createdAt: number;
    expirySeconds: string;
}

export const LEGACY_POS_HIDDEN_KEY = 'pos-hidden';
export const LEGACY_POS_STANDALONE_KEY = 'pos-standalone';

export const POS_HIDDEN_KEY = 'zeus-pos-hidden';
export const POS_STANDALONE_KEY = 'zeus-pos-standalone';

export default class PosStore {
    @observable public currentOrder: Order | null = null;
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
    fiatStore: FiatStore;
    unitsStore: UnitsStore;

    constructor(
        settingsStore: SettingsStore,
        fiatStore: FiatStore,
        unitsStore: UnitsStore
    ) {
        this.settingsStore = settingsStore;
        this.fiatStore = fiatStore;
        this.unitsStore = unitsStore;
    }

    private _enrichAndFilterOrders = async (orders: Order[]) => {
        // fetch hidden orders - orders customers couldn't pay
        const hiddenOrdersItem = await Storage.getItem(POS_HIDDEN_KEY);
        const hiddenOrders = JSON.parse(hiddenOrdersItem || '[]');

        const enrichedOrders = await Promise.all(
            orders.map(async (order: any) => {
                const payment = await Storage.getItem(`pos-${order.id}`);
                if (hiddenOrders.includes(order.id)) {
                    order.hidden = true;
                }
                if (payment) {
                    order.payment = JSON.parse(payment);
                }
                return order;
            })
        );

        const openOrders = enrichedOrders.filter(
            (order: any) => !order.payment && !order.hidden
        );
        const paidOrders = enrichedOrders.filter((order: any) => order.payment);

        runInAction(() => {
            this.openOrders = openOrders;
            this.filteredOpenOrders = openOrders;
            this.paidOrders = paidOrders;
            this.filteredPaidOrders = paidOrders;
            this.loading = false;
        });
    };

    @action
    public processCheckout = async (
        navigation: any,
        isQuickPay: boolean = false
    ) => {
        const currentOrder = this.currentOrder;
        if (!currentOrder) return;

        await this.saveStandaloneOrder(currentOrder);

        if (!isQuickPay) {
            navigation.navigate('Order', { order: currentOrder });
            return;
        }

        const { settings } = this.settingsStore;
        const { fiatRates, getRate } = this.fiatStore;
        const { units } = this.unitsStore;

        const { pos, fiat } = settings;
        const merchantName = pos?.merchantName;
        const taxPercentage = pos?.taxPercentage;
        const lineItems = currentOrder.line_items;

        const memo = merchantName
            ? `${merchantName} ${localeString(
                  'views.Settings.POS.poweredByZEUS'
              )} - ${localeString('general.order')} ${currentOrder?.id}`
            : `${localeString('views.Settings.POS')} - ${localeString(
                  'general.order'
              )} ${currentOrder?.id}`;

        const fiatEntry =
            fiat && fiatRates
                ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
                : null;
        const rate = fiat && fiatRates && fiatEntry ? fiatEntry.rate : 0;

        const subTotalSats =
            (currentOrder?.total_money?.sats ?? 0) > 0
                ? currentOrder.total_money.sats
                : rate > 0
                ? new BigNumber(currentOrder?.total_money?.amount)
                      .div(100)
                      .div(rate)
                      .multipliedBy(SATS_PER_BTC)
                      .toFixed(0)
                : '0';

        const taxSats = Number(
            calculateTaxSats(lineItems, subTotalSats, rate, taxPercentage)
        );

        const totalSats = new BigNumber(subTotalSats || 0)
            .plus(taxSats)
            .toFixed(0);

        const totalFiat = new BigNumber(totalSats ?? 0)
            .multipliedBy(rate)
            .dividedBy(SATS_PER_BTC)
            .toFixed(2);

        const destination =
            settings?.ecash?.enableCashu && BackendUtils.supportsCashuWallet()
                ? 'ReceiveEcash'
                : 'Receive';

        navigation.navigate(destination, {
            amount:
                units === 'sats'
                    ? totalSats
                    : units === 'BTC'
                    ? new BigNumber(totalSats || 0).div(SATS_PER_BTC).toFixed(8)
                    : totalFiat,
            autoGenerate: true,
            memo,
            order: currentOrder,
            orderId: currentOrder.id,
            orderTip: 0,
            orderTotal: totalSats,
            exchangeRate: getRate(),
            rate
        });
    };

    @action
    public hideOrder = async (orderId: string) => {
        const hiddenOrdersItem = await Storage.getItem(POS_HIDDEN_KEY);
        const hiddenOrders = JSON.parse(hiddenOrdersItem || '[]');
        hiddenOrders.push(orderId);
        await Storage.setItem(POS_HIDDEN_KEY, hiddenOrders);
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

    public recordPayment = ({
        orderId,
        orderTotal,
        orderTip,
        exchangeRate,
        rate,
        type,
        tx,
        preimage
    }: orderPaymentInfo) =>
        Storage.setItem(`pos-${orderId}`, {
            orderId,
            orderTotal,
            orderTip,
            exchangeRate,
            rate,
            type,
            tx,
            preimage
        });

    public recordInvoice = ({
        orderId,
        payment_request,
        rHash,
        exchangeRate,
        amount,
        tip,
        createdAt,
        expirySeconds
    }: orderInvoiceInfo) => {
        Storage.setItem(`pos-invoice-${orderId}`, {
            orderId,
            payment_request,
            rHash,
            exchangeRate,
            amount,
            tip,
            createdAt,
            expirySeconds
        });
    };

    public clearCurrentOrder = () => (this.currentOrder = null);

    public createCurrentOrder = (currency: string) => {
        this.currentOrder = new Order({
            id: uuidv4(),
            created_at: new Date(Date.now()).toISOString(),
            updated_at: new Date(Date.now()).toISOString(),
            line_items: [],
            total_tax_money: { amount: 0, currency },
            total_money: { amount: 0, currency }
        });
    };

    private calcFiatAmountFromSats = (amount: string | number) => {
        const { fiatRates } = this.fiatStore;
        const { settings } = this.settingsStore;
        const { fiat } = settings;

        // replace , with . for unit separator
        const value = amount || '0';

        const fiatEntry =
            fiat && fiatRates
                ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
                : null;

        const rate = fiat && fiatRates && fiatEntry ? fiatEntry.rate : 0;

        const fiatAmount: string | number = rate
            ? new BigNumber(value.toString().replace(/,/g, '.'))
                  .dividedBy(SATS_PER_BTC)
                  .multipliedBy(rate)
                  .multipliedBy(100)
                  .toNumber()
                  .toFixed(0)
            : 0;

        return fiatAmount;
    };

    private calcSatsAmountFromFiat = (amount: string | number) => {
        const { fiatRates } = this.fiatStore;
        const { settings } = this.settingsStore;
        const { fiat } = settings;

        // replace , with . for unit separator
        const value = amount || '0';

        const fiatEntry =
            fiat && fiatRates
                ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
                : null;

        const rate = fiat && fiatRates && fiatEntry ? fiatEntry.rate : 0;

        const satsAmount: string | number = rate
            ? new BigNumber(value.toString().replace(/,/g, '.'))
                  .dividedBy(rate)
                  .multipliedBy(SATS_PER_BTC)
                  .toNumber()
                  .toFixed(0)
            : 0;

        return satsAmount;
    };

    @action
    public recalculateCurrentOrder = () => {
        if (this.currentOrder) {
            let totalFiat = new BigNumber(0);
            let totalSats = new BigNumber(0);
            this.currentOrder.line_items.forEach((item) => {
                if (item.base_price_money.sats! > 0) {
                    const addedAmount = new BigNumber(
                        item.base_price_money.sats || 0
                    ).times(item.quantity);
                    totalSats = totalSats.plus(addedAmount);
                    totalFiat = totalFiat.plus(
                        this.calcFiatAmountFromSats(addedAmount.toNumber())
                    );
                } else {
                    const addedAmount = new BigNumber(
                        item.base_price_money.amount || 0
                    ).times(item.quantity);
                    totalFiat = totalFiat.plus(addedAmount.times(100));
                    totalSats = totalSats.plus(
                        this.calcSatsAmountFromFiat(addedAmount.toNumber())
                    );
                }
            });

            this.currentOrder.total_money.amount = totalFiat.toNumber();
            this.currentOrder.total_money.sats = totalSats.toNumber();

            // calculate taxes using individual product rates when available
            const { settings } = this.settingsStore;
            const { taxPercentage } = settings.pos;

            // Check if any line items have individual tax rates
            const hasIndividualTaxRates = this.currentOrder.line_items.some(
                (item) => item.taxPercentage && item.taxPercentage !== ''
            );

            if (
                hasIndividualTaxRates ||
                (taxPercentage && taxPercentage !== '0' && taxPercentage !== '')
            ) {
                let totalTaxFiat = new BigNumber(0);

                if (hasIndividualTaxRates) {
                    this.currentOrder.line_items.forEach((item) => {
                        const itemTaxRate =
                            item.taxPercentage && item.taxPercentage !== ''
                                ? item.taxPercentage
                                : taxPercentage || '0';

                        let itemSubtotalFiat: BigNumber;

                        if (item.base_price_money.sats! > 0) {
                            const satsAmount = new BigNumber(
                                item.base_price_money.sats || 0
                            ).times(item.quantity);
                            itemSubtotalFiat = new BigNumber(
                                this.calcFiatAmountFromSats(
                                    satsAmount.toNumber()
                                )
                            ).div(100);
                        } else {
                            itemSubtotalFiat = new BigNumber(
                                item.base_price_money.amount || 0
                            ).times(item.quantity);
                        }

                        const itemTaxFiat = itemSubtotalFiat
                            .multipliedBy(new BigNumber(itemTaxRate))
                            .dividedBy(100);

                        totalTaxFiat = totalTaxFiat.plus(itemTaxFiat);
                    });
                } else {
                    totalTaxFiat = totalFiat
                        .div(100)
                        .multipliedBy(Number(taxPercentage) || 0);
                }

                this.currentOrder.total_tax_money.amount =
                    totalTaxFiat.toNumber();

                if (this.fiatStore.fiatRates) {
                    const fiatEntry = this.fiatStore.fiatRates.filter(
                        (entry: any) =>
                            entry.code === this.settingsStore.settings.fiat
                    )[0];
                    const { code } = fiatEntry;
                    this.currentOrder.total_tax_money.currency = code;
                }
            }
        }
    };

    public saveStandaloneOrder = async (updateOrder: Order) => {
        const order = this.openOrders.find((o) => o.id === updateOrder.id);

        if (order) {
            order.line_items = updateOrder.line_items;
            order.updated_at = new Date(Date.now()).toISOString();
            order.total_money = updateOrder.total_money;
        } else {
            this.openOrders.push(updateOrder);
        }

        await Storage.setItem(
            POS_STANDALONE_KEY,
            this.openOrders.concat(this.paidOrders)
        );

        this.clearCurrentOrder();
    };

    public getOrders = async () => {
        // F7: single Clover predicate — no inline duplication of
        // isCloverPosEnabled() logic (was duplicated in v3 L10-20 vs L91-99).
        if (this.isCloverPosEnabled()) {
            return this.getCloverOrders();
        }
        switch (this.settingsStore.settings.pos.posEnabled) {
            case PosEnabled.Square:
                return this.getSquareOrders();

            case PosEnabled.Standalone:
                return this.getStandaloneOrders();

            default:
                this.resetOrders();
                break;
        }
    };

    @action
    private getStandaloneOrders = async () => {
        this.loading = true;
        this.error = false;

        const soOrders = await Storage.getItem(POS_STANDALONE_KEY);

        const orders = JSON.parse(soOrders || '[]').map(
            (order: any) => new Order(order)
        );

        await this._enrichAndFilterOrders(orders);
    };

    @action
    private getSquareOrders = async () => {
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

                    await this._enrichAndFilterOrders(orders);
                } else {
                    runInAction(() => {
                        this.openOrders = [];
                        this.paidOrders = [];
                        this.loading = false;
                        this.error = true;
                    });
                }
            })
            .catch((err) => {
                console.error('POS get orders err', err);
                runInAction(() => {
                    this.openOrders = [];
                    this.paidOrders = [];
                    this.loading = false;
                    this.error = true;
                });
            });
    };

    // Clover POS integration (open bounty, Square-parity where Clover API allows).
    // Minimal shapes — avoids `any` hiding real bugs (review checklist).
    // Full OpenAPI: docs.clover.com/dev/reference/ordergetorders.md
    private getCloverApiHost = (devMode?: boolean) =>
        devMode
            ? 'https://apisandbox.dev.clover.com'
            : 'https://api.clover.com';

    private mapCloverOrderToZeusOrder = (cloverOrder: any) => {
        const rawLineItems =
            cloverOrder?.lineItems?.elements || cloverOrder?.lineItems || [];
        const lineItems = (Array.isArray(rawLineItems) ? rawLineItems : []).map(
            (li: any) => {
                // Clover docs: unitQty is fixed-point x1000, PER_UNIT only; otherwise ignore.
                // ordergetorders.md: "fixed-point integer with scaling factor of 1000
                // (e.g. 2500 for 2.5 ounces)... If the item doesn't have a priceType
                // of PER_UNIT, then unitQty is ignored."
                // F4: gate on priceType === 'PER_UNIT' — stale unitQty on
                // EACH/VARIABLE items must not produce fractional quantities.
                let quantity = 1;
                if (
                    li.priceType === 'PER_UNIT' &&
                    li.unitQty != null &&
                    !isNaN(Number(li.unitQty))
                ) {
                    const q = Number(li.unitQty) / 1000;
                    if (isFinite(q) && q > 0) quantity = q;
                }
                // F7: NaN-guard on price — non-numeric strings add 0, not NaN.
                const priceRaw = Number(li.price);
                const priceAmount = isFinite(priceRaw) ? priceRaw : 0;
                return {
                    name: li.name || 'Item',
                    quantity,
                    base_price_money: {
                        amount: priceAmount
                    }
                };
            }
        );
        const currency = cloverOrder.currency || 'USD';
        // Clover docs: NO order-level taxAmount. Tax lives on payments[].taxAmount
        // (ordergetorders.md top-level order props have no taxAmount; taxAmount only
        // under payments/refunds/taxRates). Sum expanded payments instead of reading
        // non-existent cloverOrder.taxAmount (which always evaluated to 0).
        const rawPayments =
            cloverOrder?.payments?.elements || cloverOrder?.payments || [];
        const taxFromPayments = (Array.isArray(rawPayments) ? rawPayments : []).reduce(
            (sum: number, p: any) => {
                // F7: NaN-guard — "abc"/undefined contributes 0, never NaN.
                const n = Number(p.taxAmount);
                return sum + (isFinite(n) ? n : 0);
            },
            0
        );
        // F7: NaN-guard on order total — non-numeric total becomes 0.
        const totalRaw = Number(cloverOrder.total);
        const totalAmount = isFinite(totalRaw) ? totalRaw : 0;
        return new Order({
            id: cloverOrder.id,
            created_at: cloverOrder.createdTime
                ? new Date(Number(cloverOrder.createdTime)).toISOString()
                : new Date().toISOString(),
            updated_at: cloverOrder.modifiedTime
                ? new Date(Number(cloverOrder.modifiedTime)).toISOString()
                : new Date().toISOString(),
            line_items: lineItems,
            total_money: {
                amount: totalAmount,
                currency
            },
            total_tax_money: {
                amount: taxFromPayments,
                currency
            },
            // NOTE: Clover has no `tenders` (Square term; zero hits in Clover
            // ordergetorders.md). Preserve raw order note for keyword filtering
            // instead of fabricating a Square-shaped tenders array.
            // F6: BaseModel ctor copies all keys (Object.keys loop), so `note`
            // survives `new Order()` today (verified vs models/BaseModel.ts).
            // Filtering still runs on the RAW payload BEFORE mapping (see
            // filterRawCloverOrders) so a future strict Order ctor cannot turn
            // the filter into a silent pass-all.
            note: cloverOrder.note || ''
        });
    };

    private isCloverPosEnabled = (): boolean => {
        const posEnabled: any =
            this.settingsStore.settings.pos.posEnabled;
        return (
            posEnabled === (PosEnabled as any).Clover ||
            (typeof posEnabled === 'string' &&
                posEnabled.toLowerCase() === 'clover')
        );
    };

    // F6: Square parity — orders WITHOUT a note are hidden, not shown.
    // Square requires tenders[0].note (missing note => filtered out); Clover
    // v3 did `if (!note) return true` which inverts that and floods POS with
    // foreign orders when notes are empty. Now `false`, explicit + commented.
    // Shared predicate (F7 DRY) for mapped Orders and raw Clover payloads.
    private cloverNoteMatches = (note: any): boolean => {
        if (!note) return false;
        const lowered = String(note).toLowerCase();
        return (
            lowered.includes('zeus') ||
            lowered.includes('zues') ||
            lowered.includes('bitcoin') ||
            lowered.includes('btc') ||
            lowered.includes('bit coin')
        );
    };

    private filterCloverOrders = (orders: Array<Order>) =>
        orders.filter((order: any) => this.cloverNoteMatches(order?.note));

    // F6: raw-payload filter — MUST run BEFORE mapCloverOrderToZeusOrder.
    private filterRawCloverOrders = (rawOrders: Array<any>) =>
        (Array.isArray(rawOrders) ? rawOrders : []).filter((o: any) =>
            this.cloverNoteMatches(o?.note)
        );

    // F3: ReactNativeBlobUtil.fetch has no timeout option — race it so a
    // stalled Clover API cannot leave `loading=true` forever. Default 15s.
    // Square has the same gap, but that is not a reason to repeat it here.
    private cloverFetchWithTimeout = (url: string, headers: any, timeoutMs = 15000) =>
        Promise.race([
            ReactNativeBlobUtil.fetch('GET', url, headers),
            new Promise((_, reject) =>
                setTimeout(
                    () => reject(new Error('Clover request timed out')),
                    timeoutMs
                )
            )
        ]);

    // F5: shared historical recon — ONE implementation for Square + Clover,
    // no 50-line copy-paste drift. Safe Storage JSON (try/catch +
    // Array.isArray), safe BigNumber (isFinite gate on rate/orderTip),
    // NaN-proof tally (one bad order never poisons reconTotal into "NaN").
    private _enrichHistoricalRecon = async (orders: Array<any>) => {
        let hiddenOrders: string[] = [];
        try {
            const raw = await Storage.getItem(POS_HIDDEN_KEY);
            const parsed = JSON.parse(raw || '[]');
            if (Array.isArray(parsed)) hiddenOrders = parsed;
        } catch {}
        let total = 0;
        let tax = 0;
        let tips = 0;
        let exportString =
            'orderId, totalSats, tipSats, rateFull, rateNumerical, type, tx\n';
        const enrichedOrders = await Promise.all(
            orders.map(async (order: any) => {
                let stored: any = null;
                try {
                    const s = await Storage.getItem(`pos-${order.id}`);
                    if (s) stored = JSON.parse(s);
                } catch {}
                let tip;
                if (hiddenOrders.includes(order.id)) {
                    order.hidden = true;
                }
                if (stored) {
                    order.payment = stored;
                    const {
                        orderId,
                        orderTotal,
                        orderTip,
                        exchangeRate,
                        rate,
                        type,
                        tx
                    } = order.payment;
                    const rateNum = Number(rate);
                    const tipNum = Number(orderTip);
                    if (isFinite(rateNum) && isFinite(tipNum)) {
                        try {
                            tip = new BigNumber(tipNum)
                                .multipliedBy(rateNum)
                                .dividedBy(SATS_PER_BTC)
                                .toFixed(2);
                        } catch {}
                    }
                    exportString += `${orderId}, ${orderTotal}, ${orderTip}, ${exchangeRate}, ${rate}, ${type}, ${tx}\n`;
                }
                const tm = Number(order.getTotalMoney);
                const txm = Number(order.getTaxMoney);
                if (isFinite(tm)) total += tm;
                if (isFinite(txm)) {
                    total += txm;
                    tax += txm;
                }
                const tipN = Number(tip);
                if (tip !== undefined && isFinite(tipN)) {
                    tips += tipN;
                } else if (order.autoGratuity) {
                    const g = Number(order.autoGratuity);
                    if (isFinite(g)) tips += g;
                }
                return order;
            })
        );
        runInAction(() => {
            this.completedOrders = enrichedOrders;
            this.reconTotal = total.toFixed(2);
            this.reconTax = tax.toFixed(2);
            this.reconTips = tips.toFixed(2);
            this.reconExport = exportString;
            this.loading = false;
        });
    };

    @action
    private getCloverOrders = async () => {
        const pos: any = this.settingsStore.settings.pos;
        const cloverAccessToken = pos.cloverAccessToken;
        const cloverMerchantId = pos.cloverMerchantId;
        const cloverDevMode = pos.cloverDevMode;
        this.loading = true;
        this.error = false;
        if (!cloverAccessToken || !cloverMerchantId) {
            runInAction(() => {
                this.openOrders = [];
                this.paidOrders = [];
                this.loading = false;
                this.error = true;
            });
            return;
        }
        const apiHost = this.getCloverApiHost(cloverDevMode);
        // F7: encode merchant id; F2: return the promise so callers can await.
        // F3: timeout via race + strict === + runInAction-only mutations.
        return this.cloverFetchWithTimeout(
            `${apiHost}/v3/merchants/${encodeURIComponent(
                cloverMerchantId
            )}/orders?expand=lineItems,payments&limit=100`,
            {
                Authorization: `Bearer ${cloverAccessToken}`,
                'Content-Type': 'application/json'
            }
        )
            .then(async (response: any) => {
                const status = response.info().status;
                if (status === 200) {
                    const payload = response.json();
                    const rawOrders =
                        payload.elements || payload.orders || [];
                    // F6: filter RAW notes before mapping (Order-roundtrip safe).
                    const orders = this.filterRawCloverOrders(rawOrders).map(
                        (o: any) => this.mapCloverOrderToZeusOrder(o)
                    );
                    runInAction(() => {
                        this.loading = false;
                    });
                    await this._enrichAndFilterOrders(orders);
                } else {
                    runInAction(() => {
                        this.openOrders = [];
                        this.paidOrders = [];
                        this.loading = false;
                        this.error = true;
                    });
                }
            })
            .catch((err) => {
                console.error('POS get clover orders err', err);
                runInAction(() => {
                    this.openOrders = [];
                    this.paidOrders = [];
                    this.loading = false;
                    this.error = true;
                });
            });
    };

    @action
    private getCloverOrdersHistorical = async (hours = 24) => {
        const pos: any = this.settingsStore.settings.pos;
        const cloverAccessToken = pos.cloverAccessToken;
        const cloverMerchantId = pos.cloverMerchantId;
        const cloverDevMode = pos.cloverDevMode;
        this.loading = true;
        this.error = false;
        // F1: historical credentials guard — same as getCloverOrders; never
        // fetch merchants/undefined with `Bearer undefined`.
        if (!cloverAccessToken || !cloverMerchantId) {
            runInAction(() => {
                this.completedOrders = [];
                this.loading = false;
                this.error = true;
            });
            return;
        }
        const apiHost = this.getCloverApiHost(cloverDevMode);
        const startMs = Date.now() - hours * 60 * 60 * 1000;
        // F7: encode merchant id + filter expression (`>=` must be encoded).
        // F2: return promise (awaitable); F3: timeout + === + runInAction.
        return this.cloverFetchWithTimeout(
            `${apiHost}/v3/merchants/${encodeURIComponent(
                cloverMerchantId
            )}/orders?expand=lineItems,payments&limit=1000&filter=${encodeURIComponent(
                `createdTime>=${startMs}`
            )}`,
            {
                Authorization: `Bearer ${cloverAccessToken}`,
                'Content-Type': 'application/json'
            }
        )
            .then(async (response: any) => {
                const status = response.info().status;
                if (status === 200) {
                    const payload = response.json();
                    const rawOrders =
                        payload.elements || payload.orders || [];
                    // F6: filter RAW notes before mapping.
                    const orders = this.filterRawCloverOrders(rawOrders).map(
                        (o: any) => this.mapCloverOrderToZeusOrder(o)
                    );
                    // F5: shared recon — no inline 50-line Square copy.
                    await this._enrichHistoricalRecon(orders);
                } else {
                    runInAction(() => {
                        this.completedOrders = [];
                        this.loading = false;
                        this.error = true;
                    });
                }
            })
            .catch((err) => {
                console.error('POS get clover historical orders err', err);
                runInAction(() => {
                    this.completedOrders = [];
                    this.loading = false;
                    this.error = true;
                });
            });
    };

    @action
    public getOrdersHistorical = async (hours = 24) => {
        if (this.isCloverPosEnabled()) {
            return this.getCloverOrdersHistorical(hours);
        }
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
                if (status === 200) {
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

                    // F5: shared recon (was 50-line Square/Clover duplicate).
                    // _enrichHistoricalRecon sets completedOrders/recon* +
                    // loading=false inside runInAction with safe JSON/BigNumber.
                    await this._enrichHistoricalRecon(orders);
                } else {
                    runInAction(() => {
                        this.completedOrders = [];
                        this.loading = false;
                        this.error = true;
                    });
                }
            })
            .catch((err) => {
                console.error('POS get historical orders err', err);
                runInAction(() => {
                    this.completedOrders = [];
                    this.loading = false;
                    this.error = true;
                });
            });
    };

    @action
    public getOrderPaymentById = async (
        orderId: string
    ): Promise<Order | undefined> => {
        const payment = await Storage.getItem(`pos-${orderId}`);

        if (payment) {
            return JSON.parse(payment);
        }
    };

    public getOrderInvoiceById = async (
        orderId: string
    ): Promise<orderInvoiceInfo | undefined> => {
        const invoice = await Storage.getItem(`pos-invoice-${orderId}`);
        if (invoice) {
            return JSON.parse(invoice);
        }
    };

    public clearOrderInvoice = (orderId: string) =>
        Storage.removeItem(`pos-invoice-${orderId}`);

    public isInvoiceValid = (invoiceInfo: orderInvoiceInfo): boolean => {
        const now = Date.now() / 1000;
        const expiryTime =
            invoiceInfo.createdAt + parseInt(invoiceInfo.expirySeconds, 10);
        return expiryTime > now + 60;
    };

    public canReuseInvoice = (
        invoiceInfo: orderInvoiceInfo,
        currentAmount: string,
        currentTip: string,
        currentExchangeRate: string
    ): boolean => {
        return (
            this.isInvoiceValid(invoiceInfo) &&
            invoiceInfo.amount === currentAmount &&
            invoiceInfo.tip === currentTip &&
            invoiceInfo.exchangeRate === currentExchangeRate
        );
    };

    @action
    private resetOrders = () => {
        this.openOrders = [];
        this.paidOrders = [];
        this.loading = false;
    };
}
