import * as React from 'react';
import {
    StyleSheet,
    ScrollView,
    Text,
    View
} from 'react-native';
import { Header, Icon } from 'react-native-elements';
import CollapsedQR from './../components/CollapsedQR';
import { inject, observer } from 'mobx-react';
import { version, playStore } from './../package.json';
import PrivacyUtils from './../utils/PrivacyUtils';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import NodeInfoStore from './../stores/NodeInfoStore';
import SettingsStore from './../stores/SettingsStore';

interface NodeInfoProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
}

@inject(
    'NodeInfoStore',
    'SettingsStore'
)
@observer
export default class NodeInfo extends React.Component<
    NodeInfoProps,
    {}
> {
    UNSAFE_componentWillMount() {
        const { NodeInfoStore } = this.props;
        NodeInfoStore.getNodeInfo();
    }

    render() {
        const {
            navigation,
            NodeInfoStore,
            SettingsStore
        } = this.props;
        const { nodeInfo } = NodeInfoStore;
        const { settings } = SettingsStore;
        const { lurkerMode } = settings;

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

                <View style={styles.content}>
                    <NodeInfoView />
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
