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
import CollapsedQR from './../components/CollapsedQR';
import SetFeesForm from './../components/SetFeesForm';
import { inject, observer } from 'mobx-react';
import isNil from 'lodash/isNil';
import { version, playStore } from './../package.json';
import PrivacyUtils from './../utils/PrivacyUtils';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import NodeInfoStore from './../stores/NodeInfoStore';
import FeeStore from './../stores/FeeStore';
import UnitsStore from './../stores/UnitsStore';
import ChannelsStore from './../stores/ChannelsStore';
import SettingsStore from './../stores/SettingsStore';

interface NodeInfoProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    FeeStore: FeeStore;
    UnitsStore: UnitsStore;
    ChannelsStore: ChannelsStore;
    SettingsStore: SettingsStore;
}

interface NodeInfoState {
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

@inject(
    'NodeInfoStore',
    'FeeStore',
    'UnitsStore',
    'ChannelsStore',
    'SettingsStore'
)
@observer
export default class NodeInfo extends React.Component<
    NodeInfoProps,
    NodeInfoState
> {
    state = {
        selectedIndex: 0
    };

    UNSAFE_componentWillMount() {
        const { NodeInfoStore, FeeStore, SettingsStore } = this.props;
        const { implementation } = SettingsStore;
        NodeInfoStore.getNodeInfo();
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
            NodeInfoStore,
            UnitsStore,
            ChannelsStore,
            SettingsStore
        } = this.props;
        const { selectedIndex } = this.state;
        const { nodeInfo } = NodeInfoStore;
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
        const { settings, implementation } = SettingsStore;
        const { lurkerMode } = settings;

        const generalInfoButton = () => (
            <React.Fragment>
                <Text>{localeString('views.NodeInfo.generalInfo')}</Text>
            </React.Fragment>
        );

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
                { element: generalInfoButton },
                { element: feesButton },
                { element: forwardingHistoryButton }
            ];
        } else {
            buttons = [{ element: generalInfoButton }, { element: feesButton }];
        }

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        const URIs = (props: { uris: Array<string> }) => {
            const items: any = [];

            props.uris.forEach((uri, key) => {
                items.push(
                    <React.Fragment key={key}>
                        <CollapsedQR
                            value={uri}
                            copyText={localeString('views.NodeInfo.copyUri')}
                        />
                    </React.Fragment>
                );
            });

            return items;
        };

        const NodeInfoView = () => (
            <React.Fragment>
                <Text style={styles.label}>
                    {localeString('views.NodeInfo.alias')}:
                </Text>
                <Text style={styles.value}>
                    {PrivacyUtils.sensitiveValue(nodeInfo.alias, 10)}
                </Text>

                {nodeInfo.version && (
                    <>
                        <Text style={styles.label}>
                            {localeString(
                                'views.NodeInfo.implementationVersion'
                            )}
                            :
                        </Text>
                        <Text style={styles.value}>
                            {PrivacyUtils.sensitiveValue(nodeInfo.version, 12)}
                        </Text>
                    </>
                )}

                <Text style={styles.label}>
                    {localeString('views.NodeInfo.zeusVersion')}:
                </Text>
                <Text style={styles.value}>
                    {playStore ? `v${version}-play` : `v${version}`}
                </Text>

                {!!nodeInfo.synced_to_chain && (
                    <React.Fragment>
                        <Text style={styles.label}>
                            {localeString('views.NodeInfo.synced')}:
                        </Text>
                        <Text
                            style={{
                                ...styles.value,
                                color: nodeInfo.synced_to_chain
                                    ? 'green'
                                    : 'red'
                            }}
                        >
                            {nodeInfo.synced_to_chain ? 'True' : 'False'}
                        </Text>
                    </React.Fragment>
                )}

                <Text style={styles.label}>
                    {localeString('views.NodeInfo.blockHeight')}:
                </Text>
                <Text style={styles.value}>{nodeInfo.currentBlockHeight}</Text>

                {nodeInfo.block_hash && (
                    <React.Fragment>
                        <Text style={styles.label}>
                            {localeString('views.NodeInfo.blockHash')}:
                        </Text>
                        <Text style={styles.value}>{nodeInfo.block_hash}</Text>
                    </React.Fragment>
                )}

                <Text style={styles.label}>
                    {localeString('views.NodeInfo.uris')}:
                </Text>
                {nodeInfo.getURIs &&
                nodeInfo.getURIs.length > 0 &&
                !lurkerMode ? (
                    <URIs uris={nodeInfo.getURIs} />
                ) : (
                    <Text style={{ ...styles.value, color: 'red' }}>
                        {localeString('views.NodeInfo.noUris')}
                    </Text>
                )}
            </React.Fragment>
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

                <SetFeesForm
                    FeeStore={FeeStore}
                    SettingsStore={SettingsStore}
                />
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
                        text: 'Node Info',
                        style: { color: '#fff' }
                    }}
                    backgroundColor="#1f2328"
                />

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

                <View style={styles.content}>
                    {selectedIndex === 0 && <NodeInfoView />}
                    {selectedIndex === 1 && <FeeReportView />}
                    {selectedIndex === 2 && <ForwardingHistoryView />}
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
    },
    qrPadding: {
        width: 250,
        height: 250,
        backgroundColor: 'white',
        alignItems: 'center',
        paddingTop: 25,
        marginBottom: 10
    }
});
