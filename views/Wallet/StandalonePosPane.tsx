import * as React from 'react';
import {
    Animated,
    FlatList,
    View,
    Text,
    TouchableHighlight,
    TouchableOpacity,
    SectionList
} from 'react-native';
import BigNumber from 'bignumber.js';
import { ButtonGroup, SearchBar } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import moment from 'moment';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import LoadingIndicator from '../../components/LoadingIndicator';
import WalletHeader from '../../components/WalletHeader';
import { Row } from '../../components/layout/Row';
import { Spacer } from '../../components/layout/Spacer';

import OrderItem from './OrderItem';
import Product, { PricedIn, ProductStatus } from '../../models/Product';

import ActivityStore from '../../stores/ActivityStore';
import FiatStore from '../../stores/FiatStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import PosStore from '../../stores/PosStore';
import UnitsStore, { SATS_PER_BTC } from '../../stores/UnitsStore';
import SettingsStore from '../../stores/SettingsStore';
import InventoryStore from '../../stores/InventoryStore';

import { localeString } from '../../utils/LocaleUtils';
import { protectedNavigation } from '../../utils/NavigationUtils';
import { themeColor } from '../../utils/ThemeUtils';

import { version } from './../../package.json';

interface StandalonePosPaneProps {
    navigation: StackNavigationProp<any, any>;
    ActivityStore: ActivityStore;
    FiatStore: FiatStore;
    NodeInfoStore: NodeInfoStore;
    PosStore: PosStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
    InventoryStore: InventoryStore;
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

    async UNSAFE_componentWillMount(): Promise<void> {
        this.fetchProducts();
        this.loadCurrentOrder();
    }

    loadCurrentOrder = async () => {
        const { PosStore } = this.props;
        if (PosStore.currentOrder) {
            const { currentOrder } = PosStore;
            this.setState({
                itemQty:
                    currentOrder?.line_items.reduce(
                        (n, { quantity }) => n + quantity,
                        0
                    ) ?? 0,
                totalMoneyDisplay: currentOrder.getTotalMoneyDisplay
            });
        }
    };

    fetchProducts = async () => {
        try {
            const { InventoryStore } = this.props;
            const { getInventory } = InventoryStore;
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

    renderItem = ({ item, index }, onClickPaid, onClickHide) => {
        const { navigation, FiatStore } = this.props;
        const { getRate, getSymbol } = FiatStore;
        const isPaid: boolean = item && item.payment;

        let row: Array<any> = [];
        let prevOpenedRow;

        const closeRow = (index) => {
            if (prevOpenedRow && prevOpenedRow !== row[index]) {
                prevOpenedRow.close();
            }
            prevOpenedRow = row[index];
        };

        const renderRightActions = (
            progress,
            dragX,
            onClickPaid,
            onClickHide
        ) => {
            return (
                <View
                    style={{
                        margin: 0,
                        alignContent: 'center',
                        justifyContent: 'center',
                        width: 280
                    }}
                >
                    <Row>
                        <View style={{ width: 140 }}>
                            <Button
                                onPress={onClickPaid}
                                icon={{
                                    name: 'payments',
                                    size: 25
                                }}
                                containerStyle={{ backgroundColor: 'green' }}
                                iconOnly
                            ></Button>
                        </View>
                        <View style={{ width: 140 }}>
                            <Button
                                onPress={onClickHide}
                                icon={{
                                    name: 'delete',
                                    size: 25
                                }}
                                containerStyle={{ backgroundColor: 'red' }}
                                iconOnly
                            ></Button>
                        </View>
                    </Row>
                </View>
            );
        };

        let tip = '';
        if (isPaid) {
            const { orderTip, rate } = item.payment;
            tip = new BigNumber(orderTip)
                .multipliedBy(rate)
                .dividedBy(SATS_PER_BTC)
                .toFixed(2);
        }

        return (
            <Swipeable
                renderRightActions={(progress, dragX) =>
                    renderRightActions(
                        progress,
                        dragX,
                        onClickPaid,
                        onClickHide
                    )
                }
                onSwipeableOpen={() => closeRow(index)}
                ref={(ref) => (row[index] = ref)}
            >
                <TouchableHighlight
                    onPress={() => {
                        if (getRate() === '$N/A') return;
                        navigation.navigate('Order', {
                            order: item
                        });
                    }}
                >
                    <OrderItem
                        title={item.getItemsList}
                        money={
                            isPaid
                                ? `${item.getTotalMoneyDisplay} + ${
                                      getSymbol().symbol
                                  }${tip}`
                                : item.getTotalMoneyDisplay
                        }
                        date={item.getDisplayTime}
                    />
                </TouchableHighlight>
            </Swipeable>
        );
    };

    addProductToOrder = (product: Product) => {
        const { PosStore, SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const { fiat } = settings;
        if (!PosStore.currentOrder) PosStore.createCurrentOrder(fiat || 'USD');
        const order = PosStore.currentOrder;

        if (!order) return;

        // handle products with comma separator amounts
        const productCalcPrice = Number(
            product.price.toString().replace(/,/g, '.')
        );

        const item = order.line_items.find(
            (item) =>
                item.name === product.name &&
                (item.base_price_money.amount === productCalcPrice ||
                    item.base_price_money.sats === productCalcPrice)
        );

        if (item) {
            item.quantity++;
        } else {
            order.line_items.push({
                name: product.name,
                quantity: 1,
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

    renderGridItem = ({ item }) => {
        const { UnitsStore } = this.props;

        let priceDisplay = UnitsStore.getFormattedAmount(
            item.price,
            item.pricedIn
        );

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

    renderSectionHeader = ({ section }) => {
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

    renderSection = ({ item }) => {
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
            NodeInfoStore,
            InventoryStore,
            navigation
        } = this.props;
        const { search, selectedIndex, productsList, itemQty } = this.state;
        const { setFiltersPos } = ActivityStore;
        const {
            getOrders,
            filteredOpenOrders,
            filteredPaidOrders,
            updateSearch,
            hideOrder
        } = PosStore;
        const { getRate, getFiatRates }: any = FiatStore;
        const orders =
            selectedIndex === 0
                ? []
                : selectedIndex === 1
                ? filteredOpenOrders
                : filteredPaidOrders;

        const currentOrder = PosStore.currentOrder;
        const disableButtons =
            !currentOrder ||
            (currentOrder.total_money.amount === 0 &&
                currentOrder.total_money.sats === 0);

        const headerString =
            selectedIndex === 0
                ? localeString('general.pos')
                : `${localeString('general.pos')} (${orders.length || 0})`;

        const error = NodeInfoStore.error || SettingsStore.error;

        const loading = PosStore.loading || InventoryStore.loading;

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

        if (error) {
            return (
                <View
                    style={{
                        backgroundColor: themeColor('error'),
                        paddingTop: 20,
                        paddingLeft: 10,
                        flex: 1
                    }}
                >
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            color: '#fff',
                            fontSize: 20,
                            marginTop: 20,
                            marginBottom: 25
                        }}
                    >
                        {SettingsStore.errorMsg
                            ? SettingsStore.errorMsg
                            : NodeInfoStore.errorMsg
                            ? NodeInfoStore.errorMsg
                            : localeString('views.Wallet.MainPane.error')}
                    </Text>
                    <Button
                        icon={{
                            name: 'settings',
                            size: 25,
                            color: '#fff'
                        }}
                        title={localeString(
                            'views.Wallet.MainPane.goToSettings'
                        )}
                        buttonStyle={{
                            backgroundColor: 'gray',
                            borderRadius: 30
                        }}
                        containerStyle={{
                            alignItems: 'center'
                        }}
                        onPress={() => {
                            protectedNavigation(navigation, 'Menu');
                        }}
                        adaptiveWidth
                    />
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            color: '#fff',
                            fontSize: 12,
                            marginTop: 20,
                            marginBottom: -40
                        }}
                    >
                        {`v${version}`}
                    </Text>
                </View>
            );
        }

        return (
            <View style={{ flex: 1 }}>
                <WalletHeader
                    title={headerString}
                    navigation={navigation}
                    SettingsStore={SettingsStore}
                />

                {fiatEnabled && getRate() === '$N/A' && (
                    <Animated.View
                        style={{
                            alignSelf: 'center',
                            opacity: this.state.fadeAnimation
                        }}
                    >
                        <Text
                            style={{
                                color: themeColor('text'),
                                marginBottom: 10
                            }}
                        >
                            {localeString(
                                'pos.views.Wallet.PosPane.fetchingRates'
                            )}
                        </Text>
                    </Animated.View>
                )}
                {fiatEnabled && getRate() !== '$N/A' && (
                    <TouchableOpacity onPress={() => getFiatRates()}>
                        <Text
                            style={{
                                color:
                                    getRate() === '$N/A'
                                        ? themeColor('error')
                                        : themeColor('text'),
                                alignSelf: 'center',
                                marginBottom: 10
                            }}
                        >
                            {getRate() === '$N/A'
                                ? localeString('general.fiatFetchError')
                                : getRate()}
                        </Text>
                    </TouchableOpacity>
                )}

                {!loading && (
                    <ButtonGroup
                        onPress={(selectedIndex: number) => {
                            this.setState({ selectedIndex });
                        }}
                        selectedIndex={selectedIndex}
                        buttons={buttons}
                        selectedButtonStyle={{
                            backgroundColor: themeColor('highlight'),
                            borderRadius: 12
                        }}
                        containerStyle={{
                            backgroundColor: themeColor('secondary'),
                            borderRadius: 12,
                            borderColor: themeColor('secondary')
                        }}
                        innerBorderStyle={{
                            color: themeColor('secondary')
                        }}
                    />
                )}

                {loading && (
                    <View style={{ marginTop: 40 }}>
                        <LoadingIndicator />
                    </View>
                )}

                {!loading &&
                    ((selectedIndex === 0 &&
                        productsList &&
                        productsList.length > 0) ||
                        (orders &&
                            orders.length > 0 &&
                            selectedIndex !== 0)) && (
                        <SearchBar
                            placeholder={localeString('general.search')}
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

                {!loading &&
                    selectedIndex === 0 &&
                    productsList &&
                    productsList.length === 0 && (
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

                {!loading && selectedIndex === 0 && (
                    <>
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
                        <View
                            style={{
                                flexDirection: 'row',
                                paddingLeft: 10,
                                paddingRight: 10,
                                paddingTop: 5,
                                marginBottom: 10
                            }}
                        >
                            <Button
                                title={`${localeString('general.charge')} (${
                                    currentOrder
                                        ? (itemQty > 0 ? `${itemQty} - ` : '') +
                                          (fiatEnabled
                                              ? this.state.totalMoneyDisplay
                                              : ` ${this.props.UnitsStore.getAmountFromSats(
                                                    currentOrder?.total_money
                                                        ?.sats
                                                )}`)
                                        : '0'
                                })`}
                                containerStyle={{
                                    borderRadius: 12,
                                    flex: 3,
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
                                    // there is no order so we can't charge
                                    if (!currentOrder) return;

                                    // save the current order. This will move it to the open orders screen
                                    await PosStore.saveStandaloneOrder(
                                        currentOrder
                                    );

                                    // now let's create the charge
                                    navigation.navigate('Order', {
                                        order: currentOrder
                                    });
                                }}
                            />
                            <Button
                                title={localeString('general.clear')}
                                containerStyle={{
                                    borderRadius: 12,
                                    flex: 1
                                }}
                                onPress={() => {
                                    PosStore.clearCurrentOrder();
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

                {!loading &&
                    orders &&
                    orders.length > 0 &&
                    selectedIndex !== 0 && (
                        <FlatList
                            data={orders
                                .slice()
                                .sort((a, b) =>
                                    moment(a.updated_at).unix() >
                                    moment(b.updated_at).unix()
                                        ? -1
                                        : 1
                                )}
                            renderItem={(v: any) =>
                                this.renderItem(
                                    v,
                                    () => {
                                        setFiltersPos().then(() => {
                                            navigation.navigate('Activity', {
                                                order: v
                                            });
                                        });
                                    },
                                    () => {
                                        hideOrder(v.item.id).then(() =>
                                            getOrders()
                                        );
                                    }
                                )
                            }
                            ListFooterComponent={<Spacer height={100} />}
                            onRefresh={() => getOrders()}
                            refreshing={loading}
                            keyExtractor={(_, index) => `${index}`}
                        />
                    )}

                {!loading &&
                    orders &&
                    orders.length === 0 &&
                    selectedIndex !== 0 && (
                        <TouchableOpacity onPress={() => getOrders()}>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    margin: 10,
                                    textAlign: 'center'
                                }}
                            >
                                {selectedIndex === 1
                                    ? localeString(
                                          'pos.views.Wallet.PosPane.noOrdersStandalone'
                                      )
                                    : localeString(
                                          'pos.views.Wallet.PosPane.noOrdersPaid'
                                      )}
                            </Text>
                        </TouchableOpacity>
                    )}
            </View>
        );
    }
}
