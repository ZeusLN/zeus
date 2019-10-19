import * as React from 'react';
import { StyleSheet, ScrollView, Text, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import CollapsedQR from './../components/CollapsedQR';
import { inject, observer } from 'mobx-react';

import NodeInfoStore from './../stores/NodeInfoStore';
import SettingsStore from './../stores/SettingsStore';

interface InvoiceProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
}

@inject('NodeInfoStore', 'SettingsStore')
@observer
export default class NodeInfo extends React.Component<InvoiceProps> {
    render() {
        const { navigation, NodeInfoStore, SettingsStore } = this.props;
        const { nodeInfo } = NodeInfoStore;
        const { settings } = SettingsStore;
        const { theme } = settings;

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
                <View style={styles.content}>
                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Alias:
                    </Text>
                    <Text
                        style={
                            theme === 'dark' ? styles.valueDark : styles.value
                        }
                    >
                        {nodeInfo.alias}
                    </Text>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Version:
                    </Text>
                    <Text
                        style={
                            theme === 'dark' ? styles.valueDark : styles.value
                        }
                    >
                        {nodeInfo.version}
                    </Text>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Synced to Chain:
                    </Text>
                    <Text
                        style={{
                            ...styles.value,
                            color: nodeInfo.synced_to_chain ? 'green' : 'red'
                        }}
                    >
                        {nodeInfo.synced_to_chain ? 'True' : 'False'}
                    </Text>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Block Height
                    </Text>
                    <Text
                        style={
                            theme === 'dark' ? styles.valueDark : styles.value
                        }
                    >
                        {nodeInfo.block_height}
                    </Text>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Block Hash
                    </Text>
                    <Text
                        style={
                            theme === 'dark' ? styles.valueDark : styles.value
                        }
                    >
                        {nodeInfo.block_hash}
                    </Text>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        URIs:
                    </Text>
                    {nodeInfo.uris && nodeInfo.uris.length > 0 ? (
                        <URIs uris={nodeInfo.uris} />
                    ) : (
                        <Text style={{ ...styles.value, color: 'red' }}>
                            No URIs available
                        </Text>
                    )}
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1
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
