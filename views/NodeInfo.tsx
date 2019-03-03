import * as React from 'react';
import { StyleSheet, ScrollView, Text, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import QRCode from 'react-native-qrcode';
import CopyButton from './../components/CopyButton';

import NodeInfoStore from './../stores/NodeInfoStore';

interface InvoiceProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
}

@inject('NodeInfoStore')
@observer
export default class NodeInfo extends React.Component<InvoiceProps> {
    render() {
        const { navigation, NodeInfoStore } = this.props;
        const { nodeInfo } = NodeInfoStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        const URIs = (props: { uris: Array<any> }) => {
            const items: any = [];

            props. uris.forEach((uri, key) => {
                items.push(
                    <React.Fragment key={key}>
                        <View style={styles.center}>
                            <QRCode
                                value={uri}
                                size={200}
                                fgColor='white'
                            />
                        </View>
                        <Text style={styles.value}>{uri}</Text>
                        <CopyButton
                            copyValue={uri}
                            title="Copy URI"
                        />
                    </React.Fragment>
                );
            });

            return items;
        }

        return (
            <ScrollView style={styles.container}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{ text: 'Node Info', style: { color: '#fff' } }}
                    backgroundColor='black'
                />
                <View style={styles.content}>
                    <Text style={styles.label}>Alias:</Text>
                    <Text style={styles.value}>{nodeInfo.alias}</Text>

                    <Text style={styles.label}>Version:</Text>
                    <Text style={styles.value}>{nodeInfo.version}</Text>

                    <Text style={styles.label}>Synced to Chain:</Text>
                    <Text style={{ ...styles.value, color: nodeInfo.synced_to_chain ? 'green' : 'red' }}>{nodeInfo.synced_to_chain ? 'True' : 'False'}</Text>

                    <Text style={styles.label}>Block Height</Text>
                    <Text style={styles.value}>{nodeInfo.block_height}</Text>

                    <Text style={styles.label}>Block Hash</Text>
                    <Text style={styles.value}>{nodeInfo.block_hash}</Text>

                    <Text style={styles.label}>URIs:</Text>
                    {nodeInfo.uris && nodeInfo.uris.length > 0 ? <URIs uris={nodeInfo.uris} /> : <Text style={{ ...styles.value, color: 'red' }}>No URIs available</Text>}
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    center: {
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 10
    },
    label: {
        paddingTop: 5
    },
    value: {
        paddingBottom: 5
    }
});