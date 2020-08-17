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
import { isNil } from 'lodash';
import { version, playStore } from './../package.json';
import PrivacyUtils from './../utils/PrivacyUtils';

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

const ForwardingHistory = ({
    events,
    lurkerMode,
    getAmount,
    aliasesById
}: any) => {
    let eventsDisplay: any = [];
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        eventsDisplay.push(
            `Timestamp: ${
                lurkerMode
                    ? PrivacyUtils.hideValue(event.getTime, 10)
                    : event.getTime
            }`
        );
        eventsDisplay.push(
            `Source Channel ID: ${
                lurkerMode
                    ? PrivacyUtils.hideValue(event.chan_id_in, 10)
                    : aliasesById[event.chan_id_in] || event.chan_id_in
            }`
        );
        eventsDisplay.push(
            `Destination Channel ID: ${
                lurkerMode
                    ? PrivacyUtils.hideValue(event.chan_id_out, 10)
                    : aliasesById[event.chan_id_out] || event.chan_id_out
            }`
        );
        eventsDisplay.push(
            `Amount In: ${
                lurkerMode
                    ? PrivacyUtils.hideValue(getAmount(event.amt_in), 5, true)
                    : getAmount(event.amt_in)
            }`
        );
        eventsDisplay.push(
            `Amount Out: ${
                lurkerMode
                    ? PrivacyUtils.hideValue(getAmount(event.amt_out), 5, true)
                    : getAmount(event.amt_out)
            }`
        );
        eventsDisplay.push(
            `Fee: ${
                lurkerMode
                    ? PrivacyUtils.hideValue(event.fee, 3, true)
                    : event.fee
            }`
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
        const { theme, lurkerMode } = settings;

        const generalInfoButton = () => (
            <React.Fragment>
                <Text>General Info</Text>
            </React.Fragment>
        );

        const feesButton = () => (
            <React.Fragment>
                <Text>Fee Report</Text>
            </React.Fragment>
        );

        const forwardingHistoryButton = () => (
            <React.Fragment>
                <Text>Forwarding</Text>
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
                            theme={theme}
                            copyText="Copy URI"
                        />
                    </React.Fragment>
                );
            });

            return items;
        };

        const NodeInfoView = () => (
            <React.Fragment>
                <Text
                    style={theme === 'dark' ? styles.labelDark : styles.label}
                >
                    Alias:
                </Text>
                <Text
                    style={theme === 'dark' ? styles.valueDark : styles.value}
                >
                    {lurkerMode
                        ? PrivacyUtils.hideValue(nodeInfo.alias, 10)
                        : nodeInfo.alias}
                </Text>

                <Text
                    style={theme === 'dark' ? styles.labelDark : styles.label}
                >
                    Implementation Version:
                </Text>
                <Text
                    style={theme === 'dark' ? styles.valueDark : styles.value}
                >
                    {lurkerMode
                        ? PrivacyUtils.hideValue(nodeInfo.version, 12)
                        : nodeInfo.version}
                </Text>

                <Text
                    style={theme === 'dark' ? styles.labelDark : styles.label}
                >
                    Zeus Version:
                </Text>
                <Text
                    style={theme === 'dark' ? styles.valueDark : styles.value}
                >
                    {playStore ? `v${version}-play` : `v${version}`}
                </Text>

                {!!nodeInfo.synced_to_chain && (
                    <React.Fragment>
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            Synced to Chain:
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

                <Text
                    style={theme === 'dark' ? styles.labelDark : styles.label}
                >
                    Block Height
                </Text>
                <Text
                    style={theme === 'dark' ? styles.valueDark : styles.value}
                >
                    {nodeInfo.currentBlockHeight}
                </Text>

                {nodeInfo.block_hash && (
                    <React.Fragment>
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            Block Hash
                        </Text>
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.valueDark
                                    : styles.value
                            }
                        >
                            {nodeInfo.block_hash}
                        </Text>
                    </React.Fragment>
                )}

                <Text
                    style={theme === 'dark' ? styles.labelDark : styles.label}
                >
                    URIs:
                </Text>
                {nodeInfo.getURIs &&
                nodeInfo.getURIs.length > 0 &&
                !lurkerMode ? (
                    <URIs uris={nodeInfo.getURIs} />
                ) : (
                    <Text style={{ ...styles.value, color: 'red' }}>
                        No URIs available
                    </Text>
                )}
            </React.Fragment>
        );

        const FeeReportView = () => (
            <React.Fragment>
                <TouchableOpacity onPress={() => changeUnits()}>
                    {!isNil(dayEarned) && (
                        <React.Fragment>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Earned today:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {units &&
                                    (lurkerMode
                                        ? PrivacyUtils.hideValue(
                                              getAmount(dayEarned),
                                              5,
                                              true
                                          )
                                        : getAmount(dayEarned))}
                            </Text>
                        </React.Fragment>
                    )}

                    {!isNil(weekEarned) && (
                        <React.Fragment>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Earned this week:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {units &&
                                    (lurkerMode
                                        ? PrivacyUtils.hideValue(
                                              getAmount(weekEarned),
                                              5,
                                              true
                                          )
                                        : getAmount(weekEarned))}
                            </Text>
                        </React.Fragment>
                    )}

                    {!isNil(monthEarned) && (
                        <React.Fragment>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Earned this month:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {units &&
                                    (lurkerMode
                                        ? PrivacyUtils.hideValue(
                                              getAmount(monthEarned),
                                              5,
                                              true
                                          )
                                        : getAmount(monthEarned))}
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
                        Error fetching forwarding history
                    </Text>
                )}

                {forwardingEvents && !loading && (
                    <TouchableOpacity onPress={() => changeUnits()}>
                        <Text style={{ paddingTop: 10, paddingBottom: 10 }}>
                            <ForwardingHistory
                                events={forwardingEvents}
                                lurkerMode={lurkerMode}
                                getAmount={getAmount}
                                aliasesById={aliasesById}
                            />
                        </Text>
                    </TouchableOpacity>
                )}
            </React.Fragment>
        );

        return (
            <ScrollView
                style={
                    theme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: 'Node Info',
                        style: { color: '#fff' }
                    }}
                    backgroundColor="black"
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
    lightThemeStyle: {
        flex: 1,
        backgroundColor: 'white'
    },
    darkThemeStyle: {
        flex: 1,
        backgroundColor: 'black',
        color: 'white'
    },
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    label: {
        paddingTop: 5
    },
    qrPadding: {
        width: 250,
        height: 250,
        backgroundColor: 'white',
        alignItems: 'center',
        paddingTop: 25,
        marginBottom: 10
    },
    value: {
        paddingBottom: 5
    },
    labelDark: {
        paddingTop: 5,
        color: 'white'
    },
    valueDark: {
        paddingBottom: 5,
        color: 'white'
    }
});
