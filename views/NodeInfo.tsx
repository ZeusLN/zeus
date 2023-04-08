import * as React from 'react';
import { StyleSheet, ScrollView, Text } from 'react-native';
import { inject, observer } from 'mobx-react';

import CollapsedQR from '../components/CollapsedQR';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';

import { version } from '../package.json';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import NodeInfoStore from '../stores/NodeInfoStore';
import SettingsStore from '../stores/SettingsStore';

interface NodeInfoProps {
    navigation: any;
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
                <KeyValue
                    keyValue={localeString('views.NodeInfo.alias')}
                    value={nodeInfo.alias}
                    sensitive
                />

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
                        keyValue={localeString('views.NodeInfo.zeusVersion')}
                        value={`v${version}`}
                    />
                )}

                {!!nodeInfo.synced_to_chain && (
                    <KeyValue
                        keyValue={localeString('views.NodeInfo.synced')}
                        value={nodeInfo.synced_to_chain ? 'True' : 'False'}
                        color={nodeInfo.synced_to_chain ? 'green' : 'red'}
                    />
                )}

                <KeyValue
                    keyValue={localeString('views.NodeInfo.blockHeight')}
                    value={nodeInfo.currentBlockHeight}
                />

                {nodeInfo.block_hash && (
                    <KeyValue
                        keyValue={localeString('views.NodeInfo.blockHash')}
                        value={nodeInfo.block_hash}
                    />
                )}

                <KeyValue keyValue={localeString('views.NodeInfo.uris')} />
                {nodeInfo.getURIs &&
                nodeInfo.getURIs.length > 0 &&
                !lurkerMode ? (
                    <URIs uris={nodeInfo.getURIs} />
                ) : (
                    <Text style={styles.error}>
                        {localeString('views.NodeInfo.noUris')}
                    </Text>
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
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    navigation={navigation}
                />

                <ScrollView style={styles.content}>
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
    },
    error: {
        paddingBottom: 5,
        color: 'red',
        fontFamily: 'Lato-Regular'
    }
});
