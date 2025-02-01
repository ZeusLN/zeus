import * as React from 'react';
import { RefreshControl, StyleSheet, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import CollapsedQR from '../components/CollapsedQR';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';

import { version } from '../package.json';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import { numberWithCommas } from '../utils/UnitsUtils';

import NodeInfoStore from '../stores/NodeInfoStore';
import SettingsStore from '../stores/SettingsStore';

interface NodeInfoProps {
    navigation: StackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
}

@inject('NodeInfoStore', 'SettingsStore')
@observer
export default class NodeInfo extends React.Component<NodeInfoProps, {}> {
    UNSAFE_componentWillMount() {
        const { NodeInfoStore } = this.props;
        NodeInfoStore.getNodeInfo();
    }

    render() {
        const { navigation, NodeInfoStore, SettingsStore } = this.props;
        const { nodeInfo } = NodeInfoStore;
        const { settings } = SettingsStore;
        const { privacy } = settings;
        const lurkerMode = (privacy && privacy.lurkerMode) || false;

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

                {nodeInfo.currentBlockHeight && (
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

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.NodeInfo.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />

                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                        <RefreshControl
                            refreshing={NodeInfoStore.loading}
                            onRefresh={() => NodeInfoStore.getNodeInfo()}
                        />
                    }
                >
                    <NodeInfoView />
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    }
});
