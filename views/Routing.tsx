import * as React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ButtonGroup, Header, Icon } from 'react-native-elements';
import SetFeesForm from './../components/SetFeesForm';
import { inject, observer } from 'mobx-react';
import isNil from 'lodash/isNil';
import PrivacyUtils from './../utils/PrivacyUtils';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import FeeStore from './../stores/FeeStore';
import UnitsStore from './../stores/UnitsStore';
import ChannelsStore from './../stores/ChannelsStore';
import SettingsStore from './../stores/SettingsStore';

interface RoutingProps {
    navigation: any;
    FeeStore: FeeStore;
    UnitsStore: UnitsStore;
    ChannelsStore: ChannelsStore;
    SettingsStore: SettingsStore;
}

interface RoutingState {
    selectedIndex: number;
}

const ForwardingHistory = ({ events, getAmount, aliasesById }: any) => {
    let eventsDisplay: any = [];
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        eventsDisplay.push(
            `${localeString(
                'views.NodeInfo.ForwardingHistory.timestamp'
            )}: ${PrivacyUtils.sensitiveValue(event.getTime, 10)}`
        );
        eventsDisplay.push(
            `${localeString(
                'views.NodeInfo.ForwardingHistory.srcChannelId'
            )}: ${PrivacyUtils.sensitiveValue(
                aliasesById[event.chan_id_in] || event.chan_id_in,
                10
            )}`
        );
        eventsDisplay.push(
            `${localeString(
                'views.NodeInfo.ForwardingHistory.dstChannelId'
            )}: ${PrivacyUtils.sensitiveValue(
                aliasesById[event.chan_id_out] || event.chan_id_out,
                10
            )}`
        );
        eventsDisplay.push(
            `${localeString(
                'views.NodeInfo.ForwardingHistory.amtIn'
            )}: ${PrivacyUtils.sensitiveValue(
                getAmount(event.amt_in),
                5,
                true
            )}`
        );
        eventsDisplay.push(
            `${localeString(
                'views.NodeInfo.ForwardingHistory.amtOut'
            )}: ${PrivacyUtils.sensitiveValue(
                getAmount(event.amt_out),
                5,
                true
            )}`
        );
        eventsDisplay.push(
            `${localeString(
                'views.NodeInfo.ForwardingHistory.fee'
            )}: ${PrivacyUtils.sensitiveValue(event.fee, 3, true)}`
        );
        eventsDisplay.push('');
    }

    return eventsDisplay.join('\n');
};

@inject('FeeStore', 'UnitsStore', 'ChannelsStore', 'SettingsStore')
@observer
export default class Routing extends React.Component<
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

    componentDidMount() {
        const { navigation } = this.props;
        const selectedIndex: number = navigation.getParam('selectedIndex');

        if (selectedIndex) {
            this.setState({
                selectedIndex
            });
        }
    }

    updateIndex = (selectedIndex: number) => {
        this.setState({
            selectedIndex
        });
    };

    render() {
        const {
            navigation,
            FeeStore,
            UnitsStore,
            ChannelsStore,
            SettingsStore
        } = this.props;
        const { selectedIndex } = this.state;
        const { aliasesById } = ChannelsStore;
        const {
            dayEarned,
            weekEarned,
            monthEarned,
            forwardingEvents,
            forwardingHistoryError,
            loading
        } = FeeStore;
        const { changeUnits, getAmount, units } = UnitsStore;
        const { implementation } = SettingsStore;

        const feesButton = () => (
            <React.Fragment>
                <Text>{localeString('views.NodeInfo.feeReport')}</Text>
            </React.Fragment>
        );

        const forwardingHistoryButton = () => (
            <React.Fragment>
                <Text>{localeString('views.NodeInfo.forwarding')}</Text>
            </React.Fragment>
        );

        let buttons;
        if (implementation === 'lnd') {
            buttons = [
                { element: feesButton },
                { element: forwardingHistoryButton }
            ];
        } else {
            buttons = [{ element: feesButton }];
        }

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        const FeeReportView = () => (
            <React.Fragment>
                <TouchableOpacity onPress={() => changeUnits()}>
                    {!isNil(dayEarned) && (
                        <React.Fragment>
                            <Text style={styles.label}>
                                {localeString('views.NodeInfo.earnedToday')}:
                            </Text>
                            <Text style={styles.value}>
                                {units &&
                                    PrivacyUtils.sensitiveValue(
                                        getAmount(dayEarned),
                                        5,
                                        true
                                    )}
                            </Text>
                        </React.Fragment>
                    )}

                    {!isNil(weekEarned) && (
                        <React.Fragment>
                            <Text style={styles.label}>
                                {localeString('views.NodeInfo.earnedWeek')}:
                            </Text>
                            <Text style={styles.value}>
                                {units &&
                                    PrivacyUtils.sensitiveValue(
                                        getAmount(weekEarned),
                                        5,
                                        true
                                    )}
                            </Text>
                        </React.Fragment>
                    )}

                    {!isNil(monthEarned) && (
                        <React.Fragment>
                            <Text style={styles.label}>
                                {localeString('views.NodeInfo.earnedMonth')}:
                            </Text>
                            <Text style={styles.value}>
                                {units &&
                                    PrivacyUtils.sensitiveValue(
                                        getAmount(monthEarned),
                                        5,
                                        true
                                    )}
                            </Text>
                        </React.Fragment>
                    )}
                </TouchableOpacity>

                <SetFeesForm FeeStore={FeeStore} />
            </React.Fragment>
        );

        const ForwardingHistoryView = () => (
            <React.Fragment>
                {loading && <ActivityIndicator size="large" color="#0000ff" />}

                {forwardingHistoryError && (
                    <Text style={{ color: 'red' }}>
                        {localeString('views.NodeInfo.ForwardingHistory.error')}
                    </Text>
                )}

                {forwardingEvents && !loading && (
                    <TouchableOpacity onPress={() => changeUnits()}>
                        <Text
                            style={{
                                paddingTop: 10,
                                paddingBottom: 10,
                                color: themeColor('text')
                            }}
                        >
                            <ForwardingHistory
                                events={forwardingEvents}
                                getAmount={getAmount}
                                aliasesById={aliasesById}
                            />
                        </Text>
                    </TouchableOpacity>
                )}
            </React.Fragment>
        );

        return (
            <ScrollView style={styles.scrollView}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('general.routing'),
                        style: { color: '#fff' }
                    }}
                    backgroundColor="#1f2328"
                />

                {implementation === 'lnd' && (
                    <ButtonGroup
                        onPress={this.updateIndex}
                        selectedIndex={selectedIndex}
                        buttons={buttons}
                        selectedButtonStyle={{
                            backgroundColor: 'white'
                        }}
                        containerStyle={{
                            backgroundColor: '#f2f2f2'
                        }}
                    />
                )}

                <View style={styles.content}>
                    {selectedIndex === 0 && <FeeReportView />}
                    {selectedIndex === 1 && <ForwardingHistoryView />}
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
        backgroundColor: themeColor('background'),
        color: themeColor('text')
    },
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    label: {
        paddingTop: 5,
        color: themeColor('text')
    },
    value: {
        paddingBottom: 5,
        color: themeColor('text')
    }
});
