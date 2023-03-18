import * as React from 'react';
import { FlatList, View, Text, TouchableOpacity } from 'react-native';
import { ButtonGroup, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { Spacer } from '../../components/layout/Spacer';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';

import Pie from '../../assets/images/SVG/Pie.svg';

import FeeStore from '../../stores/FeeStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import { RoutingListItem } from './RoutingListItem';
import { RoutingHeader } from './RoutingHeader';

interface RoutingProps {
    navigation: any;
    FeeStore: FeeStore;
}

interface RoutingState {
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

@inject('FeeStore')
@observer
export default class Routing extends React.PureComponent<
    RoutingProps,
    RoutingState
> {
    state = {
        selectedIndex: 0
    };

    UNSAFE_componentWillMount() {
        const { FeeStore } = this.props;
        FeeStore.getFees();
        if (BackendUtils.isLNDBased()) {
            FeeStore.getForwardingHistory(HOURS[0]);
        }
    }

    renderItem = ({ item }) => {
        const { navigation } = this.props;
        return (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('RoutingEvent', {
                        routingEvent: item
                    })
                }
            >
                <RoutingListItem
                    title={localeString('views.Routing.received')}
                    fee={item.fee_msat / 1000}
                    amountOut={item.amt_out}
                    date={item.getDateShort}
                />
            </TouchableOpacity>
        );
    };

    render() {
        const { FeeStore, navigation } = this.props;
        const { selectedIndex } = this.state;
        const {
            dayEarned,
            weekEarned,
            monthEarned,
            totalEarned,
            earnedDuringTimeframe,
            forwardingEvents,
            forwardingHistoryError,
            getForwardingHistory
        } = FeeStore;

        const loading = FeeStore.loading || FeeStore.loadingFees;

        const headerString =
            forwardingEvents.length > 0
                ? `${localeString('general.routing')} (${
                      forwardingEvents.length
                  })`
                : localeString('general.routing');

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        const FeeBadge = ({ navigation }: { navigation: any }) => (
            <TouchableOpacity onPress={() => navigation.navigate('SetFees')}>
                <Pie stroke={themeColor('highlight')} />
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
                    rightComponent={<FeeBadge navigation={navigation} />}
                    backgroundColor="transparent"
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <RoutingHeader
                    dayEarned={dayEarned}
                    weekEarned={weekEarned}
                    monthEarned={monthEarned}
                    totalEarned={totalEarned}
                    timeframeEarned={earnedDuringTimeframe}
                    fullSize={!BackendUtils.isLNDBased()}
                />
                {BackendUtils.isLNDBased() && (
                    <View style={{ flex: 1 }}>
                        <ButtonGroup
                            onPress={(selectedIndex: number) => {
                                getForwardingHistory(HOURS[selectedIndex]);
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
                        {loading && (
                            <View style={{ top: 40 }}>
                                <LoadingIndicator />
                            </View>
                        )}
                        {forwardingEvents.length > 0 && !loading && (
                            <FlatList
                                data={forwardingEvents}
                                renderItem={this.renderItem}
                                ListFooterComponent={<Spacer height={100} />}
                                onRefresh={() =>
                                    getForwardingHistory(HOURS[selectedIndex])
                                }
                                refreshing={false}
                                keyExtractor={(item, index) =>
                                    `${item.getTime}-${index}`
                                }
                            />
                        )}
                        {forwardingEvents.length === 0 && !loading && (
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
                        {forwardingHistoryError && !loading && (
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
