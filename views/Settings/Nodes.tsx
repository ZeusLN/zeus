import * as React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Avatar, Button, ListItem } from 'react-native-elements';
import SettingsStore from './../../stores/SettingsStore';
import Identicon from 'identicon.js';
const hash = require('object-hash');
import PrivacyUtils from './../../utils/PrivacyUtils';

interface NodesProps {
    nodes: any[];
    navigation: any;
    edit?: boolean;
    loading?: boolean;
    theme?: string;
    selectedNode?: number;
    SettingsStore: SettingsStore;
}

export default class Nodes extends React.Component<NodesProps, {}> {
    renderSeparator = () => {
        const { theme } = this.props;
        return (
            <View
                style={
                    theme === 'dark'
                        ? styles.darkSeparator
                        : styles.lightSeparator
                }
            />
        );
    };

    render() {
        const {
            navigation,
            nodes,
            theme,
            loading,
            selectedNode,
            SettingsStore
        } = this.props;
        const { setSettings, settings } = SettingsStore;
        const { lurkerMode } = settings;

        const Node = (balanceImage: string) => (
            <Avatar
                source={{
                    uri: balanceImage
                }}
            />
        );

        return (
            <View>
                {!!nodes && nodes.length > 0 && (
                    <FlatList
                        data={nodes}
                        renderItem={({ item, index }) => {
                            const displayName = item.port
                                ? `${item.host}:${item.port}`
                                : item.host;

                            const title = lurkerMode
                                ? PrivacyUtils.hideValue(displayName, 8)
                                : displayName;
                            const implementation = lurkerMode
                                ? PrivacyUtils.hideValue(item.implementation, 8)
                                : item.implementation || 'lnd';

                            const data = new Identicon(
                                hash.sha1(title),
                                255
                            ).toString();

                            return (
                                <React.Fragment>
                                    <ListItem
                                        title={title}
                                        leftElement={Node(
                                            `data:image/png;base64,${data}`
                                        )}
                                        rightElement={
                                            <Button
                                                title=""
                                                icon={{
                                                    name: 'settings',
                                                    size: 25,
                                                    color:
                                                        theme === 'dark'
                                                            ? 'white'
                                                            : 'black'
                                                }}
                                                buttonStyle={{
                                                    backgroundColor:
                                                        'transparent',
                                                    marginRight: -10
                                                }}
                                                onPress={() =>
                                                    navigation.navigate(
                                                        'AddEditNode',
                                                        {
                                                            node: item,
                                                            index: index,
                                                            active:
                                                                selectedNode ===
                                                                index,
                                                            saved: true
                                                        }
                                                    )
                                                }
                                            />
                                        }
                                        subtitle={
                                            selectedNode === index ||
                                            (!selectedNode && index === 0)
                                                ? `Active | ${implementation}`
                                                : implementation
                                        }
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor:
                                                theme === 'dark'
                                                    ? 'black'
                                                    : 'white'
                                        }}
                                        onPress={() => {
                                            setSettings(
                                                JSON.stringify({
                                                    nodes,
                                                    theme: settings.theme,
                                                    selectedNode: index,
                                                    onChainAddress:
                                                        settings.onChainAddress,
                                                    fiat: settings.fiat,
                                                    lurkerMode:
                                                        settings.lurkerMode,
                                                    passphrase:
                                                        settings.passphrase
                                                })
                                            ).then(() => {
                                                navigation.navigate('Wallet', {
                                                    refresh: true
                                                });
                                            });
                                        }}
                                        titleStyle={{
                                            color:
                                                theme === 'dark'
                                                    ? 'white'
                                                    : 'black'
                                        }}
                                        subtitleStyle={{
                                            color:
                                                theme === 'dark'
                                                    ? 'gray'
                                                    : '#8a8999'
                                        }}
                                    />
                                </React.Fragment>
                            );
                        }}
                        refreshing={loading}
                        keyExtractor={(item, index) => `${item.host}-${index}`}
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                    />
                )}
                {nodes && nodes.length === 0 && !loading && (
                    <Button
                        title="No Nodes"
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: theme === 'dark' ? 'white' : 'black'
                        }}
                        buttonStyle={{
                            backgroundColor: 'transparent',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: theme === 'dark' ? 'white' : 'black'
                        }}
                    />
                )}
                {!loading && (
                    <Button
                        title="Add a new node"
                        icon={{
                            name: 'add',
                            size: 25,
                            color: 'white'
                        }}
                        buttonStyle={{
                            borderRadius: 30,
                            width: 200,
                            alignSelf: 'center',
                            marginBottom: 20,
                            backgroundColor: 'crimson'
                        }}
                        onPress={() =>
                            navigation.navigate('AddEditNode', {
                                newEntry: true,
                                index:
                                    (nodes &&
                                        nodes.length &&
                                        Number(nodes.length)) ||
                                    0
                            })
                        }
                        titleStyle={{
                            color: 'white'
                        }}
                    />
                )}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    lightSeparator: {
        height: 1,
        width: '86%',
        backgroundColor: '#CED0CE',
        marginLeft: '14%'
    },
    darkSeparator: {
        height: 1,
        width: '86%',
        backgroundColor: 'darkgray',
        marginLeft: '14%'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 10
    }
});
