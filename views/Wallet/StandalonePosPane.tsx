import * as React from 'react';
import {
    Animated,
    FlatList,
    View,
    Text,
    TouchableOpacity,
    SectionList
} from 'react-native';

import { SearchBar } from '@rneui/themed';

import { inject, observer } from 'mobx-react';
import moment from 'moment';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import OrderList from '../POS/OrderList';
import Layout from '../../views/POS/Layout';

import Product, { PricedIn, ProductStatus } from '../../models/Product';

import ActivityStore from '../../stores/ActivityStore';
import FiatStore from '../../stores/FiatStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import PosStore from '../../stores/PosStore';
import UnitsStore from '../../stores/UnitsStore';
import SettingsStore from '../../stores/SettingsStore';
import InventoryStore from '../../stores/InventoryStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { SATS_PER_BTC } from '../../utils/UnitsUtils';
import { getFormattedAmount, getAmountFromSats } from '../../utils/AmountUtils';

interface StandalonePosPaneProps {
    navigation: StackNavigationProp<any, any>;
    ActivityStore?: ActivityStore;
    FiatStore?: FiatStore;
    NodeInfoStore?: NodeInfoStore;
    PosStore?: PosStore;
    UnitsStore?: UnitsStore;
    SettingsStore?: SettingsStore;
    InventoryStore?: InventoryStore;
}

interface ProductDataItems {
    items: Array<Product>;
}

interface ProductSectionList {
    title: string;
    data: ProductDataItems[];
}

interface StandalonePosPaneState {
    selectedIndex: number;
    search: string;
    fadeAnimation: any;
    productsList: Array<ProductSectionList>;
    itemQty: number;
    totalMoneyDisplay: string;
}

@inject(
    'ActivityStore',
    'FiatStore',
    'NodeInfoStore',
    'PosStore',
    'UnitsStore',
    'SettingsStore',
    'InventoryStore'
)
@observer
export default class StandalonePosPane extends React.PureComponent<
    StandalonePosPaneProps,
    StandalonePosPaneState
> {
    constructor(props: any) {
        super(props);
        this.state = {
            selectedIndex: 0,
            search: '',
            fadeAnimation: new Animated.Value(1),
            productsList: [],
            itemQty: 0,
            totalMoneyDisplay: '0'
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

    async componentDidMount(): Promise<void> {
        this.fetchProducts();
        this.loadCurrentOrder();
    }

    loadCurrentOrder = async () => {
        const { PosStore } = this.props;
        if (PosStore!.currentOrder) {
            const { currentOrder } = PosStore!;
            this.setState({
                itemQty:
                    currentOrder?.line_items.reduce(
                        (n, { quantity }) => n + quantity,
                        0
                    ) ?? 0,
                totalMoneyDisplay: currentOrder!.getTotalMoneyDisplay
            });
        }
    };

    fetchProducts = async () => {
        try {
            const { InventoryStore } = this.props;
            const { getInventory } = InventoryStore!;
            const { products } = await getInventory();

            const uncategorized: Array<Product> = [];
            const productsList: Array<ProductSectionList> = [];
            products?.forEach((product) => {
                if (product.status !== ProductStatus.Active) return;
                if (product.category === '') {
                    uncategorized.push(product);
                } else {
                    const category = productsList.find(
                        (c) => c.title === product.category
                    );
                    if (category) {
                        category.data[0].items.push(product);
                    } else {
                        productsList.push({
                            title: product.category,
                            data: [{ items: [product] }]
                        });
                    }
                }
            });
            if (uncategorized.length > 0) {
                productsList.push({
                    title: localeString(
                        'pos.views.Wallet.PosPane.uncategorized'
                    ),
                    data: [
                        {
                            items: uncategorized.sort((a, b) =>
                                a.name.localeCompare(b.name)
                            )
                        }
                    ]
                });
            }

            this.setState({
                productsList: productsList.sort((a, b) => {
                    a.data[0].items = a.data[0].items.sort((_a, _b) =>
                        _a.name.localeCompare(_b.name)
                    );
                    return a.title.localeCompare(b.title);
                })
            });
        } catch (e) {
            console.log('error fetching products', e);
        }
    };

    addProductToOrder = (product: Product) => {
        const { PosStore, SettingsStore } = this.props;
        const { settings } = SettingsStore!;
        const { fiat } = settings;
        if (!PosStore!.currentOrder)
            PosStore?.createCurrentOrder(fiat || 'USD');
        const order = PosStore?.currentOrder;

        if (!order) return;

        // handle products with comma separator amounts
        const productCalcPrice = Number(
            product.price.toString().replace(/,/g, '.')
        );

        const item = order.line_items.find((item) => {
            const nameMatches = item.name === product.name;
            const taxMatches = item.taxPercentage === product.taxPercentage;

            let priceMatches = false;
            if (product.pricedIn === PricedIn.Fiat) {
                priceMatches =
                    item.base_price_money.amount === productCalcPrice;
            } else {
                priceMatches = item.base_price_money.sats === productCalcPrice;
            }

            return nameMatches && priceMatches && taxMatches;
        });

        if (item) {
            item.quantity++;
        } else {
            order.line_items.push({
                name: product.name,
                quantity: 1,
                taxPercentage: product.taxPercentage || '',
                base_price_money: {
                    amount:
                        product.pricedIn === PricedIn.Fiat
                            ? productCalcPrice
                            : 0,
                    sats:
                        product.pricedIn === PricedIn.Sats
                            ? productCalcPrice
                            : product.pricedIn === PricedIn.Bitcoin
                            ? productCalcPrice * SATS_PER_BTC
                            : 0
                }
            });
        }

        PosStore.recalculateCurrentOrder();

        this.setState({
            itemQty:
                order?.line_items.reduce(
                    (n, { quantity }) => n + quantity,
                    0
                ) ?? 0,
            totalMoneyDisplay: order.getTotalMoneyDisplay
        });
    };

    renderGridItem = ({ item }: { item: any }) => {
        let priceDisplay = getFormattedAmount(item.price, item.pricedIn);

        return (
            <TouchableOpacity
                style={{ flex: 1, maxWidth: '50%' }}
                onPress={() => this.addProductToOrder(item)}
            >
                <View
                    style={{
                        backgroundColor: themeColor('secondary'),
                        borderRadius: 25,
                        minHeight: 100,
                        alignItems: 'center',
                        margin: 5,
                        padding: 10,
                        justifyContent: 'center'
                    }}
                >
                    <Text
                        style={{
                            fontSize: 18,
                            color: themeColor('text'),
                            marginBottom: 5
                        }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {item.name}
                    </Text>
                    <Text style={{ color: themeColor('text') }}>
                        {priceDisplay}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    renderSectionHeader = ({ section }: { section: any }) => {
        return (
            <View
                style={{
                    padding: 10,
                    borderColor: themeColor('secondary'),
                    borderBottomWidth: 1
                }}
            >
                <Text
                    style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: themeColor('text')
                    }}
                >
                    {section.title}
                </Text>
            </View>
        );
    };

    renderSection = ({ item }: { item: any }) => {
        return (
            <FlatList
                data={item.items}
                numColumns={2}
                renderItem={this.renderGridItem}
                keyExtractor={(x) => x.id}
                style={{ marginTop: 10 }}
            />
        );
    };

    updateProductSearch = async (search: string) => {
        this.setState({ search });
        await this.fetchProducts();

        const updatedProductList = this.state.productsList.filter((item) => {
            if (item.title.toLowerCase().search(search.toLowerCase()) !== -1)
                return true;

            const items = item.data[0].items.find(
                (product) =>
                    product.name.toLowerCase().search(search.toLowerCase()) !==
                    -1
            );
            if (items) {
                item.data[0].items = [items];
                return true;
            }

            return false;
        });
        this.setState({ productsList: updatedProductList });
    };

    render() {
        const {
            ActivityStore,
            SettingsStore,
            PosStore,
            FiatStore,
            InventoryStore,
            navigation
        } = this.props;
        const { search, selectedIndex, productsList, itemQty, fadeAnimation } =
            this.state;
        const { setFiltersPos } = ActivityStore!;
        const {
            getOrders,
            filteredOpenOrders,
            filteredPaidOrders,
            updateSearch,
            hideOrder
        } = PosStore!;
        const orders =
            selectedIndex === 1
                ? filteredOpenOrders
                : selectedIndex === 2
                ? filteredPaidOrders
                : [];

        const currentOrder = PosStore?.currentOrder;
        const disableButtons =
            !currentOrder ||
            (currentOrder.total_money.amount === 0 &&
                currentOrder.total_money.sats === 0);

        const headerString =
            selectedIndex === 0
                ? localeString('general.pos')
                : `${localeString('general.pos')} (${orders.length || 0})`;
        const loading = PosStore?.loading || InventoryStore?.loading || false;

        const fiatEnabled = SettingsStore?.settings?.fiatEnabled;

        const newOrderButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        selectedIndex === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('general.new')}
            </Text>
        );

        const openOrdersButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        selectedIndex === 1
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('general.open')}
            </Text>
        );

        const paidOrdersButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        selectedIndex === 2
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('views.Wallet.Invoices.paid')}
            </Text>
        );

        const buttons = [
            { element: newOrderButton },
            { element: openOrdersButton },
            { element: paidOrdersButton }
        ];
        const buttonElements = buttons.map((btn) => btn.element());

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
                            if (selectedIndex === 0) {
                                this.updateProductSearch(value);
                                return;
                            }

                            updateSearch(value);
                            this.setState({
                                search: value
                            });
                        }}
                        value={search}
                        inputStyle={{
                            color: themeColor('text')
                        }}
                        placeholderTextColor={themeColor('secondaryText')}
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

                {!loading && selectedIndex === 0 && (
                    <>
                        {productsList && productsList.length === 0 && (
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    marginTop: 20,
                                    textAlign: 'center'
                                }}
                            >
                                {localeString(
                                    'views.Settings.POS.Product.noProductsDefined'
                                )}
                            </Text>
                        )}

                        <SectionList
                            sections={productsList}
                            renderSectionHeader={this.renderSectionHeader}
                            stickySectionHeadersEnabled={false}
                            renderItem={this.renderSection}
                            keyExtractor={(_, index) => `${index}`}
                            contentContainerStyle={{
                                marginLeft: 10,
                                marginRight: 10
                            }}
                        />
                        <View style={{ paddingTop: 5, marginBottom: 10 }}>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    marginBottom: 10,
                                    paddingHorizontal: 22
                                }}
                            >
                                <Button
                                    title={`${localeString(
                                        'general.charge'
                                    )} (${
                                        currentOrder
                                            ? (itemQty > 0
                                                  ? `${itemQty} - `
                                                  : '') +
                                              (fiatEnabled
                                                  ? this.state.totalMoneyDisplay
                                                  : ` ${getAmountFromSats(
                                                        currentOrder
                                                            ?.total_money?.sats
                                                    )}`)
                                            : '0'
                                    })`}
                                    containerStyle={{
                                        borderRadius: 12,
                                        flex: 2,
                                        marginRight: 5
                                    }}
                                    titleStyle={{
                                        color: themeColor('background')
                                    }}
                                    buttonStyle={{
                                        backgroundColor: themeColor('highlight')
                                    }}
                                    disabled={disableButtons}
                                    onPress={async () => {
                                        const { PosStore } = this.props;
                                        await PosStore?.processCheckout(
                                            navigation,
                                            false
                                        );
                                    }}
                                />
                                <Button
                                    title={localeString(
                                        'views.Settings.POS.quickPay'
                                    )}
                                    containerStyle={{
                                        borderRadius: 12,
                                        flex: 1
                                    }}
                                    titleStyle={{
                                        color: themeColor('background')
                                    }}
                                    buttonStyle={{
                                        backgroundColor: themeColor('highlight')
                                    }}
                                    disabled={disableButtons}
                                    onPress={async () => {
                                        const { PosStore } = this.props;
                                        await PosStore?.processCheckout(
                                            navigation,
                                            true
                                        );
                                    }}
                                />
                            </View>
                            <Button
                                title={localeString('general.clear')}
                                containerStyle={{
                                    borderRadius: 12
                                }}
                                onPress={() => {
                                    PosStore?.clearCurrentOrder();
                                    this.setState({
                                        itemQty: 0,
                                        totalMoneyDisplay: '0'
                                    });
                                }}
                                disabled={disableButtons}
                            />
                        </View>
                    </>
                )}

                {!loading && selectedIndex !== 0 && (
                    <OrderList
                        orders={orders
                            .slice()
                            .sort((a, b) =>
                                moment(a.updated_at).unix() >
                                moment(b.updated_at).unix()
                                    ? -1
                                    : 1
                            )}
                        loading={loading}
                        onRefresh={() => getOrders()}
                        navigation={navigation}
                        fiatStore={FiatStore}
                        emptyText={
                            selectedIndex === 1
                                ? localeString(
                                      'pos.views.Wallet.PosPane.noOrdersStandalone'
                                  )
                                : localeString(
                                      'pos.views.Wallet.PosPane.noOrdersPaid'
                                  )
                        }
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
