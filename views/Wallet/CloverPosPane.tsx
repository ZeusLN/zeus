import * as React from 'react';

import {
    Animated,
    FlatList,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SearchBar } from '@rneui/themed';

import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Layout from '../../views/POS/Layout';

import OrderList from '../POS/OrderList';

import { getCloverItems } from '../../utils/CloverUtils';

import ActivityStore from '../../stores/ActivityStore';
import FiatStore from '../../stores/FiatStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import PosStore from '../../stores/PosStore';
import UnitsStore from '../../stores/UnitsStore';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { placeholderColor, themeColor } from '../../utils/ThemeUtils';

// Clover POS pane — part 1 (orders list) + part 2 (catalog/cart/pay).
// Part 1: component + order list from PosStore via getOrders +
// search-filter + empty-state message (R13) + hidden/out-of-stock
// SHOW for orders (R11-orders: show, do not hide) + Wallet render-gate.
// Part 2 v2 (N1-N7 fixes over pane2): product catalog via CloverUtils.getCloverItems
// (rival name getCloverProducts; same GET items?expand=taxRates) +
// cart + Pay button -> PosStore.recordPayment -> recordCloverPayment
// (tender external_payment + tipAmount, push110 F1-F7 contract) +
// R12 dedup of similar products + success/error states + tips input.
// R14 categories: TAIL (no SectionList, no Uncategorized heading —
// flat grid only; categories need a separate expand fetch, utils N9).
// Mirrors views/Wallet/SquarePosPane.tsx (Layout + SearchBar +
// OrderList, open/paid tabs via filteredOpenOrders/filteredPaidOrders)
// so Clover read-path (zeus_fix_v4 getCloverOrders) reuses the same
// store contract without a second list implementation.
// Part 2 helpers (pure, mirror-tested in pane120 logic mirror).
// R12 dedup: shubham `We don't want to list similar products like
// this` — collapse near-duplicates (same normalized name + same
// price cents) into one row instead of listing each separately.
// Keep first occurrence; drop later dups. Prices stay in cents
// (no /100 — CloverUtils/order-adapter parity, push110 F2).
export const normalizeCloverProductName = (name: any): string =>
    String(name || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\p{L}\p{N} ]/gu, '');

export const dedupeCloverProducts = (products: any[]): any[] => {
    const seen = new Map<string, any>();
    for (const p of products || []) {
        const key =
            normalizeCloverProductName(p?.name) +
            '|' +
            Math.round(Number(p?.base_price_money?.amount) || 0);
        if (!seen.has(key)) {
            seen.set(key, p);
        }
    }
    return Array.from(seen.values());
};

// Cart total in integer cents (int64 for POST payments). Skips
// non-finite / non-positive prices (push110 F3 positive-guard parity).
export const cartTotalCents = (
    cart: Record<string, number>,
    byId: Map<string, any>
): number => {
    let total = 0;
    for (const id of Object.keys(cart || {})) {
        const qty = Number((cart as any)[id]) || 0;
        const price = Math.round(
            Number(byId.get(id)?.base_price_money?.amount) || 0
        );
        if (qty > 0 && isFinite(qty) && isFinite(price) && price > 0) {
            total += Math.round(qty) * price;
        }
    }
    return total;
};

// N3: priced cart count — counts qty only when the row has a
// finite positive price in byId (phantoms with missing/zero/
// NaN price contribute 0 to cartTotalCents, so they must not
// inflate `Cart (N)` either).
export const cartCountPriced = (
    cart: Record<string, number>,
    byId: Map<string, any>
): number => {
    let n = 0;
    for (const id of Object.keys(cart || {})) {
        const qty = Number((cart as any)[id]) || 0;
        const price = Math.round(
            Number(byId.get(id)?.base_price_money?.amount) || 0
        );
        if (qty > 0 && isFinite(qty) && isFinite(price) && price > 0) {
            n += Math.round(qty);
        }
    }
    return n;
};

// N7: pane-side tip validation (store still drops non-finite/<=0
// as tipAmount — pane surfaces an inline hint so the user knows
// the tip will be ignored).
export const isCloverTipValid = (tip: any): boolean => {
    const t = String(tip ?? '').trim();
    if (t === '') return true;
    const n = Number(t);
    return isFinite(n) && n > 0;
};

interface CloverPosPaneProps {
    navigation: NativeStackNavigationProp<any, any>;
    ActivityStore?: ActivityStore;
    FiatStore?: FiatStore;
    NodeInfoStore?: NodeInfoStore;
    PosStore?: PosStore;
    UnitsStore?: UnitsStore;
    SettingsStore?: SettingsStore;
}

interface CloverPosPaneState {
    selectedIndex: number;
    search: string;
    fadeAnimation: any;
    products: any[];
    productsLoading: boolean;
    productsError: string;
    cart: Record<string, number>;
    tip: string;
    payStatus: 'idle' | 'paying' | 'success' | 'error';
    payError: string;
}

@inject(
    'ActivityStore',
    'FiatStore',
    'NodeInfoStore',
    'PosStore',
    'UnitsStore',
    'SettingsStore'
)
@observer
export default class CloverPosPane extends React.PureComponent<
    CloverPosPaneProps,
    CloverPosPaneState
> {
    constructor(props: any) {
        super(props);
        this.state = {
            selectedIndex: 0,
            search: '',
            fadeAnimation: new Animated.Value(1),
            products: [],
            productsLoading: false,
            productsError: '',
            cart: {},
            tip: '',
            payStatus: 'idle',
            payError: ''
        };

        Animated.loop(
            Animated.sequence([
                Animated.timing(this.state.fadeAnimation, {
                    toValue: 0,
                    duration: 500,
                    delay: 1000,
                    useNativeDriver: true
                }),
                Animated.timing(this.state.fadeAnimation, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true
                })
            ])
        ).start();
    }

    componentDidMount() {
        // Part 1 entry point: pull Clover open/paid orders through the
        // shared PosStore.getOrders() contract (v4 routes to
        // getCloverOrders when Clover is enabled). Guarded so mount
        // never throws when the store is not injected (tests).
        const { PosStore } = this.props;
        try {
            if (PosStore && !PosStore.loading) {
                PosStore.getOrders();
            }
        } catch {}
        // Part 2 entry point: pull catalog (fire-and-forget; errors
        // surface via productsError + retry, never throw from mount).
        try {
            this.loadProducts();
        } catch {}
    }

    // Part 2: catalog fetch via CloverUtils.getCloverItems (paged
    // items?expand=taxRates; hidden + out-of-stock already skipped
    // inside the util — R11-products parity, pane applies NO second
    // filter). Creds from SettingsStore.pos (support both rival
    // `cloverApiToken` and push-layer `cloverAccessToken` names).
    // R12 dedup applied before setState. Never throws (error state).
    loadProducts = async (): Promise<void> => {
        const { SettingsStore } = this.props;
        const pos: any = (SettingsStore as any)?.settings?.pos || {};
        const merchantId = pos.cloverMerchantId;
        const token = pos.cloverAccessToken || pos.cloverApiToken;
        const devMode = pos.cloverDevMode;
        if (!merchantId || !token) {
            this.setState({
                productsError: 'Clover credentials missing.',
                productsLoading: false
            });
            return;
        }
        this.setState({
            productsLoading: true,
            productsError: ''
        });
        try {
            const raw = await getCloverItems(merchantId, token, {
                devMode
            });
            this.setState({
                products: dedupeCloverProducts(raw || []),
                productsLoading: false,
                productsError: ''
            });
        } catch (e: any) {
            this.setState({
                productsLoading: false,
                productsError:
                    (e && e.message) || 'Could not get products.'
            });
        }
    };

    addToCart = (id: string): void => {
        if (this.state.payStatus === 'paying') return;
        const key = String(id || '');
        if (!key) return;
        this.setState((prev: CloverPosPaneState) => ({
            cart: {
                ...(prev.cart || {}),
                [key]: (Number((prev.cart || {})[key]) || 0) + 1
            },
            payStatus: 'idle',
            payError: ''
        }));
    };

    decFromCart = (id: string): void => {
        if (this.state.payStatus === 'paying') return;
        const key = String(id || '');
        if (!key) return;
        this.setState((prev: CloverPosPaneState) => {
            const next: Record<string, number> = {
                ...(prev.cart || {})
            };
            const qty = (Number(next[key]) || 0) - 1;
            if (qty <= 0) {
                delete next[key];
            } else {
                next[key] = qty;
            }
            return {
                cart: next,
                payStatus: 'idle',
                payError: ''
            } as any;
        });
    };

    // Part 2: Pay -> PosStore.recordPayment (Clover-first, push110
    // F5: local pos-{id} written only after Clover POST success).
    // Contract: await + catch (method throws in Clover mode: missing
    // creds/glue/tender/POST — F4 fail-loudly, F6 tender sets
    // store.error). Tender resolved inside the store (cached external
    // id, F8); tip passed as orderTip (store sends tipAmount only
    // when finite > 0). In-flight double-tap guard lives in the
    // store (F1 cloverPaymentInFlight + externalPaymentId); pane
    // additionally disables the button while paying.
    handlePay = async (): Promise<void> => {
        const { PosStore } = this.props;
        const { cart, tip, products } = this.state;
        const byId = new Map<string, any>(
            (products || []).map((p: any, i: number) => [
                p?.id != null && String(p.id) !== ''
                    ? String(p.id)
                    : `idx-${i}`,
                p
            ])
        );
        const total = cartTotalCents(cart || {}, byId);
        const ids = Object.keys(cart || {});
        if (!PosStore || ids.length === 0 || total <= 0) {
            this.setState({
                payStatus: 'error',
                payError: 'Could not record Clover payment.'
            });
            return;
        }
        // N6: gate Pay on an existing open order (glue
        // pos-clover-order-{id} from saveCloverOrder is required —
        // F4). Without an open order the button is disabled (see
        // render) and this guard fails loudly with a distinct
        // message instead of attempting a doomed sentinel pay.
        const open: any[] = (PosStore as any).openOrders || [];
        if (open.length === 0) {
            this.setState({
                payStatus: 'error',
                payError:
                    'No open Clover order — create one first (saveCloverOrder).'
            });
            return;
        }
        const orderId =
            String(
                open[0]?.id || open[0]?.orderId || 'cart-current'
            ) || 'cart-current';
        this.setState({ payStatus: 'paying', payError: '' });
        try {
            await (PosStore as any).recordPayment({
                orderId,
                orderTotal: String(total),
                orderTip: tip
            });
            this.setState({
                payStatus: 'success',
                payError: '',
                cart: {},
                tip: ''
            });
            try {
                (PosStore as any).getOrders?.();
            } catch {}
        } catch (e: any) {
            this.setState({
                payStatus: 'error',
                payError:
                    (e && e.message) || 'Could not record Clover payment.'
            });
        }
    };

    render() {
        const { ActivityStore, PosStore, FiatStore, navigation } = this.props;
        const {
            search,
            selectedIndex,
            fadeAnimation,
            products,
            productsLoading,
            productsError,
            cart,
            tip,
            payStatus,
            payError
        } = this.state;
        const { setFiltersPos } = ActivityStore!;
        const {
            loading,
            getOrders,
            openOrders,
            paidOrders,
            filteredOpenOrders,
            filteredPaidOrders,
            updateSearch,
            hideOrder
        } = PosStore!;
        const orders =
            selectedIndex === 0 ? filteredOpenOrders : filteredPaidOrders;
        // R13 base: unfiltered source for the active tab. When search is
        // non-empty but the filtered slice is empty while the base is
        // non-empty, the list is empty BECAUSE of the search — show a
        // dedicated empty-search message instead of the generic noOrders.
        const baseOrders =
            selectedIndex === 0 ? openOrders : paidOrders;
        const trimmedSearch = (search || '').trim();
        const isEmptySearchResult =
            trimmedSearch !== '' &&
            (baseOrders || []).length > 0 &&
            (orders || []).length === 0;
        let emptyText: string;
        if (isEmptySearchResult) {
            // R13: separate message for empty search (no new locale key
            // in part 1; base noOrders strings stay on existing keys).
            emptyText = `No results for "${trimmedSearch}"`;
        } else {
            emptyText =
                selectedIndex === 0
                    ? localeString('pos.views.Wallet.PosPane.noOrders')
                    : localeString(
                          'pos.views.Wallet.PosPane.noOrdersPaid'
                      );
        }
        const headerString = `${localeString('general.orders')} (${
            orders.length || 0
        })`;

        // Part 2 derived: id -> product map + cart totals. R14 tail:
        // NO SectionList, NO `Uncategorized` heading — flat grid only.
        // Categories are not expanded by getCloverItems (taxRates only,
        // utils N9); a grouped view needs a separate categories fetch
        // and stays a tail for part 3+.
        const productsById = new Map<string, any>(
            (products || []).map((p: any, i: number) => [
                p?.id != null && String(p.id) !== ''
                    ? String(p.id)
                    : `idx-${i}`,
                p
            ])
        );
        const cartIds = Object.keys(cart || {});
        // N3: count only rows with a priced catalog entry.
        const cartCount = cartCountPriced(cart || {}, productsById);
        const cartTotal = cartTotalCents(cart || {}, productsById);
        const paying = payStatus === 'paying';
        // N6: Pay requires an open order (saveCloverOrder glue).
        const openList: any[] =
            (PosStore as any)?.openOrders || openOrders || [];
        const hasOpenOrder = openList.length > 0;
        // N7: pane-side tip validation hint (single source).
        const tipInvalid = !isCloverTipValid(tip);

        // R11: SHOW hidden / out-of-stock, do NOT hide in the pane.
        // PosStore marks orders with `hidden = true` (POS_HIDDEN_KEY) and
        // Clover products carry `available`; part 1 deliberately applies
        // NO extra `available`/`hidden` filter here — whatever the store
        // returns is rendered via OrderList (paid-hidden stays visible;
        // open-hidden exclusion, if any, lives in the shared store, not
        // in a second pane-side filter). No categories SectionList here
        // (R14 tail stays in part 3+; part 2 uses a flat grid — see above).

        const openOrdersButton = ({ isSelected }: { isSelected: boolean }) => (
            <Text
                style={{
                    fontSize: 16,
                    fontFamily: isSelected
                        ? 'PPNeueMontreal-Medium'
                        : 'PPNeueMontreal-Book',
                    color: isSelected
                        ? themeColor('background')
                        : themeColor('text')
                }}
            >
                {localeString('general.open')}
            </Text>
        );

        const paidOrdersButton = ({ isSelected }: { isSelected: boolean }) => (
            <Text
                style={{
                    fontSize: 16,
                    fontFamily: isSelected
                        ? 'PPNeueMontreal-Medium'
                        : 'PPNeueMontreal-Book',
                    color: isSelected
                        ? themeColor('background')
                        : themeColor('text')
                }}
            >
                {localeString('views.Wallet.Invoices.paid')}
            </Text>
        );

        const buttonElements = [
            { element: openOrdersButton },
            { element: paidOrdersButton }
        ];

        return (
            <Layout
                title={headerString}
                navigation={navigation}
                loading={loading}
                selectedIndex={selectedIndex}
                buttons={buttonElements}
                onIndexChange={(selectedIndex: number) =>
                    this.setState({ selectedIndex })
                }
                fadeAnimation={fadeAnimation}
            >
                {!loading && (
                    <SearchBar
                        placeholder={localeString('general.search')}
                        // @ts-ignore:next-line
                        onChangeText={(value: string) => {
                            updateSearch(value);
                            this.setState({ search: value });
                        }}
                        value={search}
                        inputStyle={{ color: themeColor('text') }}
                        placeholderTextColor={placeholderColor()}
                        containerStyle={{
                            backgroundColor: 'transparent',
                            borderTopWidth: 0,
                            borderBottomWidth: 0
                        }}
                        inputContainerStyle={{
                            borderRadius: 15,
                            backgroundColor: themeColor('secondary')
                        }}
                    />
                )}

                {!loading && (
                    <View style={{ marginTop: 8 }}>
                        <Text
                            style={{
                                fontSize: 16,
                                fontFamily: 'PPNeueMontreal-Medium',
                                color: themeColor('text')
                            }}
                        >
                            {localeString('general.products') || 'Products'}
                        </Text>
                        {productsLoading && (
                            <Text style={{ color: themeColor('text') }}>
                                Loading products...
                            </Text>
                        )}
                        {!productsLoading && productsError !== '' && (
                            <View>
                                <Text style={{ color: themeColor('error') }}>
                                    {productsError}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => this.loadProducts()}
                                >
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            marginTop: 4
                                        }}
                                    >
                                        Retry
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {!productsLoading &&
                            productsError === '' &&
                            (products || []).length === 0 && (
                                <Text style={{ color: themeColor('text') }}>
                                    No products yet.
                                </Text>
                            )}
                        {!productsLoading &&
                            productsError === '' &&
                            (products || []).length > 0 && (
                                <FlatList
                                    data={products}
                                    numColumns={2}
                                    keyExtractor={(
                                        item: any,
                                        index: number
                                    ) =>
                                        item?.id != null &&
                                        String(item.id) !== ''
                                            ? String(item.id)
                                            : `idx-${index}`
                                    }
                                    renderItem={({
                                        item,
                                        index
                                    }: any) => {
                                        const id =
                                            item?.id != null &&
                                            String(item.id) !== ''
                                                ? String(item.id)
                                                : `idx-${index}`;
                                        const qty =
                                            Number(
                                                (cart as any)[id]
                                            ) || 0;
                                        const cents = Math.round(
                                            Number(
                                                item?.base_price_money
                                                    ?.amount
                                            ) || 0
                                        );
                                        return (
                                            <View
                                                style={{
                                                    flex: 1,
                                                    margin: 4,
                                                    padding: 8,
                                                    borderRadius: 8,
                                                    backgroundColor:
                                                        themeColor(
                                                            'secondary'
                                                        )
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        color: themeColor(
                                                            'text'
                                                        )
                                                    }}
                                                    numberOfLines={1}
                                                >
                                                    {item?.name || 'Item'}
                                                </Text>
                                                <Text
                                                    style={{
                                                        color: themeColor(
                                                            'text'
                                                        )
                                                    }}
                                                >
                                                    {cents}c
                                                    {qty > 0
                                                        ? ` x${qty}`
                                                        : ''}
                                                </Text>
                                                <View
                                                    style={{
                                                        flexDirection:
                                                            'row',
                                                        marginTop: 4
                                                    }}
                                                >
                                                    <TouchableOpacity
                                                        disabled={paying}
                                                        onPress={() =>
                                                            this.addToCart(
                                                                id
                                                            )
                                                        }
                                                    >
                                                        <Text
                                                            style={{
                                                                color: themeColor(
                                                                    'text'
                                                                )
                                                            }}
                                                        >
                                                            Add
                                                        </Text>
                                                    </TouchableOpacity>
                                                    {qty > 0 && (
                                                        <TouchableOpacity
                                                            disabled={
                                                                paying
                                                            }
                                                            onPress={() =>
                                                                this.decFromCart(
                                                                    id
                                                                )
                                                            }
                                                            style={{
                                                                marginLeft: 12
                                                            }}
                                                        >
                                                            <Text
                                                                style={{
                                                                    color: themeColor(
                                                                        'text'
                                                                    )
                                                                }}
                                                            >
                                                                Remove
                                                            </Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    }}
                                />
                            )}
                        <View
                            style={{
                                marginTop: 8,
                                padding: 8,
                                borderRadius: 8,
                                backgroundColor: themeColor('secondary')
                            }}
                        >
                            <Text style={{ color: themeColor('text') }}>
                                Cart ({cartCount}): {cartTotal}c
                            </Text>
                            <TextInput
                                placeholder="Tip (cents)"
                                value={tip}
                                editable={!paying}
                                onChangeText={(value: string) => {
                                    if (
                                        this.state.payStatus ===
                                        'paying'
                                    )
                                        return;
                                    this.setState({
                                        tip: value,
                                        payStatus: 'idle',
                                        payError: ''
                                    } as any);
                                }}
                                keyboardType="numeric"
                                style={{ color: themeColor('text') }}
                                placeholderTextColor={placeholderColor()}
                            />
                            {tipInvalid && (
                                <Text
                                    style={{
                                        color: themeColor('error')
                                    }}
                                >
                                    Tip must be a positive number
                                    (cents) — ignored otherwise.
                                </Text>
                            )}
                            <TouchableOpacity
                                disabled={
                                    paying ||
                                    cartIds.length === 0 ||
                                    cartTotal <= 0 ||
                                    !hasOpenOrder
                                }
                                onPress={() => this.handlePay()}
                                style={{
                                    marginTop: 8,
                                    opacity:
                                        paying || !hasOpenOrder
                                            ? 0.5
                                            : 1
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 16,
                                        fontFamily:
                                            'PPNeueMontreal-Medium',
                                        color: themeColor('text')
                                    }}
                                >
                                    {paying ? 'Paying...' : 'Pay'}
                                </Text>
                            </TouchableOpacity>
                            {!hasOpenOrder && (
                                <Text
                                    style={{
                                        color: themeColor('text')
                                    }}
                                >
                                    No open order — create one first
                                    (saveCloverOrder).
                                </Text>
                            )}
                            {payStatus === 'success' && (
                                <Text style={{ color: themeColor('text') }}>
                                    Payment recorded.
                                </Text>
                            )}
                            {payStatus === 'error' && (
                                <Text style={{ color: themeColor('error') }}>
                                    {payError ||
                                        'Could not record Clover payment.'}
                                </Text>
                            )}
                        </View>
                    </View>
                )}

                {!loading && (
                    <OrderList
                        orders={orders}
                        loading={loading}
                        onRefresh={() => getOrders()}
                        navigation={navigation}
                        fiatStore={FiatStore!}
                        emptyText={emptyText}
                        onHideOrder={(id) =>
                            hideOrder(id).then(() => getOrders())
                        }
                        onOrderClick={(item) => {
                            setFiltersPos().then(() => {
                                navigation.navigate('Activity', {
                                    order: item
                                });
                            });
                        }}
                    />
                )}
            </Layout>
        );
    }
}
