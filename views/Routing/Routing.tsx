import * as React from 'react';
import {
    ActivityIndicator,
    FlatList,
    View,
    StyleSheet,
    Text,
    TouchableHighlight
} from 'react-native';
import { ButtonGroup, Header, Icon } from 'react-native-elements';

import { RoutingHeader } from './RoutingHeader';
import { WalletHeader } from '../../components/WalletHeader';
import { RoutingListItem } from './RoutingListItem';
import { Spacer } from '../../components/layout/Spacer';

import { themeColor } from './../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import { inject, observer } from 'mobx-react';

import FeeStore from '../../stores/FeeStore';
import SettingsStore from '../../stores/SettingsStore';

interface RoutingProps {
    navigation: any;
    FeeStore: FeeStore;
    SettingsStore: SettingsStore;
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

@inject('FeeStore', 'SettingsStore')
@observer
export default class Routing extends React.PureComponent<
    RoutingProps,
    RoutingState
> {
    state = {
        selectedIndex: 0
    };

    UNSAFE_componentWillMount() {
        const { FeeStore, SettingsStore } = this.props;
        const { implementation } = SettingsStore;
        FeeStore.getFees();
        if (implementation === 'lnd') {
            FeeStore.getForwardingHistory();
        }
    }

    headerString =
        this.props.FeeStore.forwardingEvents.length > 0
            ? `${localeString('general.routing')} (${
                  this.props.FeeStore.forwardingEvents.length
              })`
            : localeString('general.routing');

    renderItem = ({ item }) => {
        const { navigation } = this.props;
        return (
            <TouchableHighlight
                onPress={() =>
                    navigation.navigate('RoutingEvent', {
                        routingEvent: item
                    })
                }
            >
                <RoutingListItem
                    title={localeString('views.Routing.received')}
                    fee={item.fee}
                    amountOut={item.amt_out}
                    date={item.getDateShort}
                />
            </TouchableHighlight>
        );
    };

    render() {
        const { FeeStore, SettingsStore, navigation } = this.props;
        const { selectedIndex } = this.state;
        const {
            dayEarned,
            weekEarned,
            monthEarned,
            earnedDuringTimeframe,
            forwardingEvents,
            forwardingHistoryError,
            getForwardingHistory,
            loading
        } = FeeStore;
        const { implementation } = SettingsStore;

        const CloseButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        const oneDButton = () => (
            <Text
                style={{
                    color: selectedIndex === 0 ? themeColor('text') : 'black'
                }}
            >
                D
            </Text>
        );
        const oneWButton = () => (
            <Text
                style={{
                    color: selectedIndex === 1 ? themeColor('text') : 'black'
                }}
            >
                1W
            </Text>
        );
        const oneMButton = () => (
            <Text
                style={{
                    color: selectedIndex === 2 ? themeColor('text') : 'black'
                }}
            >
                1M
            </Text>
        );
        const threeMButton = () => (
            <Text
                style={{
                    color: selectedIndex === 3 ? themeColor('text') : 'black'
                }}
            >
                3M
            </Text>
        );
        const sixMButton = () => (
            <Text
                style={{
                    color: selectedIndex === 4 ? themeColor('text') : 'black'
                }}
            >
                6M
            </Text>
        );
        const oneYButton = () => (
            <Text
                style={{
                    color: selectedIndex === 5 ? themeColor('text') : 'black'
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
            <View style={styles.view}>
                <Header
                    leftComponent={<CloseButton />}
                    centerComponent={{
                        text: this.headerString,
                        style: { color: themeColor('text') }
                    }}
                    backgroundColor={themeColor('background')}
                />
                <RoutingHeader
                    dayEarned={dayEarned}
                    weekEarned={weekEarned}
                    monthEarned={monthEarned}
                    timeframeEarned={earnedDuringTimeframe}
                    fullSize={implementation !== 'lnd'}
                />
                {implementation === 'lnd' && (
                    <View>
                        <ButtonGroup
                            onPress={(selectedIndex: number) => {
                                getForwardingHistory(HOURS[selectedIndex]);
                                this.setState({ selectedIndex });
                            }}
                            selectedIndex={selectedIndex}
                            buttons={buttons}
                            selectedButtonStyle={{
                                backgroundColor: themeColor('highlight')
                            }}
                            containerStyle={{
                                backgroundColor: '#f2f2f2'
                            }}
                        />
                        {loading && (
                            <ActivityIndicator
                                size="large"
                                color={themeColor('highlight')}
                                style={{ top: 100 }}
                            />
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
                                    color: themeColor('text'),
                                    alignSelf: 'center',
                                    top: 100
                                }}
                            >
                                {localeString('views.Routing.noEvents')}
                            </Text>
                        )}
                        {forwardingHistoryError && !loading && (
                            <Text style={{ color: 'red' }}>
                                {localeString(
                                    'views.NodeInfo.ForwardingHistory.error'
                                )}
                            </Text>
                        )}
                    </View>
                )}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    view: {
        flex: 1,
        backgroundColor: themeColor('background'),
        color: themeColor('text')
    }
});
