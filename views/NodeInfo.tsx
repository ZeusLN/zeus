import * as React from 'react';
import { RefreshControl, StyleSheet, ScrollView, View } from 'react-native';
import { ButtonGroup } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import CollapsedQR from '../components/CollapsedQR';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';
import Text from '../components/Text';

import { version } from '../package.json';
import BackendUtils from '../utils/BackendUtils';
import { getButtonGroupStyles } from '../utils/buttonGroupStyles';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import { numberWithCommas } from '../utils/UnitsUtils';

import NodeInfoStore from '../stores/NodeInfoStore';
import SettingsStore from '../stores/SettingsStore';
import CashuStore from '../stores/CashuStore';

interface NodeInfoProps {
    navigation: NativeStackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    CashuStore: CashuStore;
}

interface NodeInfoState {
    selectedIndex: number;
}

@inject('NodeInfoStore', 'SettingsStore', 'CashuStore')
@observer
export default class NodeInfo extends React.Component<
    NodeInfoProps,
    NodeInfoState
> {
    state = {
        selectedIndex: 0
    };

    networkInfoFields = [
        {
            key: 'num_channels',
            labelKey: 'views.NetworkInfo.numChannels',
            format: numberWithCommas
        },
        {
            key: 'num_nodes',
            labelKey: 'views.NetworkInfo.numNodes',
            format: numberWithCommas
        },
        {
            key: 'num_zombie_chans',
            labelKey: 'views.NetworkInfo.numZombieChannels',
            format: numberWithCommas
        },
        { key: 'graph_diameter', labelKey: 'views.NetworkInfo.graphDiameter' },
        {
            key: 'avg_out_degree',
            labelKey: 'views.NetworkInfo.averageOutDegree'
        },
        { key: 'max_out_degree', labelKey: 'views.NetworkInfo.maxOutDegree' }
    ];

    componentDidMount() {
        const { NodeInfoStore } = this.props;
        NodeInfoStore.getNodeInfo();
        if (BackendUtils.supportsNetworkInfo()) {
            NodeInfoStore.getNetworkInfo();
        }
    }

    render() {
        const { navigation, NodeInfoStore, SettingsStore, CashuStore } =
            this.props;
        const { selectedIndex } = this.state;
        const { nodeInfo, networkInfo, loading } = NodeInfoStore;
        const { settings } = SettingsStore;
        const { privacy } = settings;
        const { selectedMintPubkey } = CashuStore;
        const lurkerMode = (privacy && privacy.lurkerMode) || false;

        const showNetworkInfo = BackendUtils.supportsNetworkInfo();
        const groupStyles = getButtonGroupStyles();

        const URIs = (props: { uris: Array<string> }) => {
            return (
                <View>
                    {props.uris.map((uri, index) => (
                        <View
                            key={index}
                            style={{
                                marginBottom:
                                    index < props.uris.length - 1 ? 30 : 10
                            }}
                        >
                            <CollapsedQR
                                value={uri}
                                copyText={localeString(
                                    'views.NodeInfo.copyUri'
                                )}
                                valueStyle={{ marginBottom: 0 }}
                            />
                        </View>
                    ))}
                </View>
            );
        };

        const NodeInfoView = () => (
            <React.Fragment>
                {nodeInfo.alias && (
                    <KeyValue
                        keyValue={localeString('views.NodeInfo.alias')}
                        value={nodeInfo.alias}
                        sensitive
                    />
                )}

                {nodeInfo.nodeId && (
                    <KeyValue
                        keyValue={localeString('views.NodeInfo.pubkey')}
                        value={nodeInfo.nodeId}
                        sensitive
                    />
                )}

                {settings?.ecash?.enableCashu && selectedMintPubkey && (
                    <KeyValue
                        keyValue={localeString(
                            'views.Settings.AddContact.cashuPubkey'
                        )}
                        value={selectedMintPubkey}
                        sensitive
                    />
                )}
                {nodeInfo.version && (
                    <KeyValue
                        keyValue={localeString(
                            'views.NodeInfo.implementationVersion'
                        )}
                        value={nodeInfo.version}
                        sensitive
                    />
                )}

                {nodeInfo.version && (
                    <KeyValue
                        keyValue={localeString(
                            'views.NodeInfo.zeusVersion'
                        ).replace('Zeus', 'ZEUS')}
                        value={`v${version}`}
                    />
                )}

                {nodeInfo.synced_to_chain != null && (
                    <KeyValue
                        keyValue={localeString('views.NodeInfo.synced')}
                        value={
                            nodeInfo.synced_to_chain
                                ? localeString('general.true')
                                : localeString('general.false')
                        }
                        color={
                            nodeInfo.synced_to_chain
                                ? themeColor('success')
                                : themeColor('error')
                        }
                    />
                )}

                {nodeInfo.synced_to_graph != null && (
                    <KeyValue
                        keyValue={localeString('views.NodeInfo.syncedToGraph')}
                        value={
                            nodeInfo.synced_to_graph
                                ? localeString('general.true')
                                : localeString('general.false')
                        }
                        color={
                            nodeInfo.synced_to_graph
                                ? themeColor('success')
                                : themeColor('error')
                        }
                    />
                )}

                {nodeInfo.currentBlockHeight !== undefined && (
                    <KeyValue
                        keyValue={localeString('views.NodeInfo.blockHeight')}
                        value={numberWithCommas(nodeInfo.currentBlockHeight)}
                    />
                )}

                {nodeInfo.block_hash && (
                    <KeyValue
                        keyValue={localeString('views.NodeInfo.blockHash')}
                        value={nodeInfo.block_hash}
                    />
                )}

                {nodeInfo.getURIs &&
                    nodeInfo.getURIs.length > 0 &&
                    !lurkerMode && (
                        <>
                            <KeyValue
                                keyValue={localeString('views.NodeInfo.uris')}
                            />
                            <URIs uris={nodeInfo.getURIs} />
                        </>
                    )}
            </React.Fragment>
        );

        const NetworkInfoView = () => (
            <React.Fragment>
                {this.networkInfoFields.map(({ key, labelKey, format }) => {
                    const value = networkInfo[key as keyof typeof networkInfo];
                    if (value != null) {
                        return (
                            <KeyValue
                                key={key}
                                keyValue={localeString(labelKey)}
                                value={format ? format(value) : value}
                            />
                        );
                    }
                    return null;
                })}
            </React.Fragment>
        );

        const buttonElement = (title: string, index: number) => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        selectedIndex === index
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {title}
            </Text>
        );

        const nodeInfoButton = () =>
            buttonElement(localeString('views.NodeInfo.title'), 0);
        const networkInfoButton = () =>
            buttonElement(localeString('views.NetworkInfo.title'), 1);

        const buttons = [{ element: nodeInfoButton }];
        if (showNetworkInfo) {
            buttons.push({ element: networkInfoButton });
        }

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={
                        showNetworkInfo
                            ? undefined
                            : {
                                  text: localeString('views.NodeInfo.title'),
                                  style: {
                                      color: themeColor('text'),
                                      fontFamily: 'PPNeueMontreal-Book'
                                  }
                              }
                    }
                    navigation={navigation}
                />

                {showNetworkInfo && (
                    <View style={styles.tabContainer}>
                        <ButtonGroup
                            onPress={(index: number) => {
                                this.setState({ selectedIndex: index });
                            }}
                            selectedIndex={selectedIndex}
                            buttons={buttons}
                            selectedButtonStyle={
                                groupStyles.selectedButtonStyle
                            }
                            containerStyle={groupStyles.containerStyle}
                            innerBorderStyle={groupStyles.innerBorderStyle}
                        />
                    </View>
                )}

                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                        <RefreshControl
                            refreshing={loading}
                            onRefresh={() => {
                                NodeInfoStore.getNodeInfo();
                                if (showNetworkInfo) {
                                    NodeInfoStore.getNetworkInfo();
                                }
                            }}
                        />
                    }
                >
                    {selectedIndex === 0 && <NodeInfoView />}
                    {selectedIndex === 1 && <NetworkInfoView />}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    tabContainer: {
        paddingHorizontal: 20
    }
});
