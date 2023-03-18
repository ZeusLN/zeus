import * as React from 'react';
import {
    FlatList,
    View,
    Text,
    TouchableHighlight,
    TouchableOpacity
} from 'react-native';
import { ButtonGroup, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';

import Screen from '../../components/Screen';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { Spacer } from '../../components/layout/Spacer';
import LoadingIndicator from '../../components/LoadingIndicator';

import Export from '../../assets/images/SVG/Export.svg';

import FiatStore from '../../stores/FiatStore';
import PosStore from '../../stores/PosStore';
import { SATS_PER_BTC } from '../../stores/UnitsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import { ReconHeader } from './PointOfSaleReconHeader';

import OrderItem from '../../views/Wallet/OrderItem';

interface PointOfSaleReconProps {
    navigation: any;
    FiatStore: FiatStore;
    PosStore: PosStore;
}

interface PointOfSaleReconState {
    selectedIndex: number;
}

const HOURS = {
    0: 24,
    1: 24 * 7,
    2: 24 * 30,
    3: 24 * 90,
    4: 24 * 180,
    5: 24 * 365
};

@inject('FiatStore', 'PosStore')
@observer
export default class PointOfSaleRecon extends React.PureComponent<
    PointOfSaleReconProps,
    PointOfSaleReconState
> {
    state = {
        selectedIndex: 0
    };

    UNSAFE_componentWillMount() {
        const { PosStore } = this.props;
        PosStore.getOrdersHistorical();
    }

    renderItem = (order) => {
        const { navigation, FiatStore } = this.props;
        const { getSymbol } = FiatStore;
        const { item } = order;
        const isPaid: boolean = item && item.payment;

        let tip = '';
        if (isPaid) {
            const { orderTip, rate } = item.payment;
            tip = new BigNumber(orderTip)
                .multipliedBy(rate)
                .dividedBy(SATS_PER_BTC)
                .toFixed(2);
        }

        return (
            <TouchableHighlight
                onPress={() => {
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
        );
    };

    render() {
        const { FiatStore, PosStore, navigation } = this.props;
        const { selectedIndex } = this.state;
        const {
            completedOrders,
            getOrdersHistorical,
            reconTotal,
            reconTax,
            reconTips,
            loading
        } = PosStore;

        const orders = completedOrders;

        const headerString =
            orders.length > 0
                ? `${localeString('views.Settings.POS.recon')} (${
                      orders.length
                  })`
                : localeString('views.Settings.POS.recon');

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        const ExportBadge = ({ navigation }: { navigation: any }) => (
            <TouchableOpacity
                onPress={() => navigation.navigate('PointOfSaleReconExport')}
            >
                <Export stroke={themeColor('highlight')} />
            </TouchableOpacity>
        );

        const oneDButton = () => (
            <Text
                style={{
                    fontFamily: 'Lato-Regular',
                    color:
                        selectedIndex === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                D
            </Text>
        );
        const oneWButton = () => (
            <Text
                style={{
                    fontFamily: 'Lato-Regular',
                    color:
                        selectedIndex === 1
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                1W
            </Text>
        );
        const oneMButton = () => (
            <Text
                style={{
                    fontFamily: 'Lato-Regular',
                    color:
                        selectedIndex === 2
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                1M
            </Text>
        );
        const threeMButton = () => (
            <Text
                style={{
                    fontFamily: 'Lato-Regular',
                    color:
                        selectedIndex === 3
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                3M
            </Text>
        );
        const sixMButton = () => (
            <Text
                style={{
                    fontFamily: 'Lato-Regular',
                    color:
                        selectedIndex === 4
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                6M
            </Text>
        );
        const oneYButton = () => (
            <Text
                style={{
                    fontFamily: 'Lato-Regular',
                    color:
                        selectedIndex === 5
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                1Y
            </Text>
        );

        const buttons = [
            { element: oneDButton },
            { element: oneWButton },
            { element: oneMButton },
            { element: threeMButton },
            { element: sixMButton },
            { element: oneYButton }
        ];

        return (
            <Screen>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: headerString,
                        style: { color: themeColor('text') }
                    }}
                    rightComponent={<ExportBadge navigation={navigation} />}
                    backgroundColor="transparent"
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <ReconHeader
                    total={reconTotal}
                    tax={reconTax}
                    tips={reconTips}
                    FiatStore={FiatStore}
                />
                {BackendUtils.isLNDBased() && (
                    <View style={{ flex: 1 }}>
                        <ButtonGroup
                            onPress={(selectedIndex: number) => {
                                getOrdersHistorical(HOURS[selectedIndex]);
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
                        {loading && <LoadingIndicator />}
                        {orders.length > 0 && !loading && (
                            <FlatList
                                data={orders}
                                renderItem={this.renderItem}
                                ListFooterComponent={<Spacer height={100} />}
                                onRefresh={() => getOrdersHistorical()}
                                refreshing={loading}
                                keyExtractor={(item, index) => `${index}`}
                            />
                        )}
                        {false && orders.length === 0 && !loading && (
                            <Text
                                style={{
                                    fontFamily: 'Lato-Regular',
                                    color: themeColor('text'),
                                    alignSelf: 'center',
                                    top: 100
                                }}
                            >
                                {localeString('views.Routing.noEvents')}
                            </Text>
                        )}
                        {false && !loading && (
                            <ErrorMessage
                                message={localeString(
                                    'views.NodeInfo.ForwardingHistory.error'
                                )}
                            />
                        )}
                    </View>
                )}
            </Screen>
        );
    }
}
