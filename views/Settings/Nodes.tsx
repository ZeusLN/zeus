import * as React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, ListItem } from 'react-native-elements';
import Identicon from 'identicon.js';
import { inject, observer } from 'mobx-react';
const hash = require('object-hash');

import SettingsStore from './../../stores/SettingsStore';

interface NodesProps {
    nodes: any[];
    navigation: any;
    settingsStore: SettingsStore;
    edit?: boolean;
}

@inject('SettingsStore')
@observer
export default class Nodes extends React.Component<NodesProps, {}> {
    renderSeparator = () => {
        const { settingsStore } = this.props;
        const { settings } = settingsStore;
        const { theme } = settings;

        return (
            <View style={theme === 'dark' ? styles.darkSeparator : styles.lightSeparator} />
        )
    }

    render() {
        const { navigation, settingsStore, nodes } = this.props;
        const { settings, loading } = settingsStore;
        const { theme } = settings;

        const Node = (balanceImage: string) => (
            <Avatar
                source={{
                    uri: balanceImage
                }}
            />
        );

        return (
            <View style={theme === 'dark' ? styles.darkThemeStyle : styles.lightThemeStyle}>
                {loading && <Text>Loading</Text>}
                {(!!nodes && !loading && nodes.length > 0) && <FlatList
                    data={nodes}
                    renderItem={({ item, index }) => {
                        const data = new Identicon(hash.sha1(item.host), 420).toString();
                        return (
                            <React.Fragment>
                                <ListItem
                                    title={item.host}
                                    leftElement={Node(`data:image/png;base64,${data}`)}
                                    subtitle={settings.selectedNode === index ? 'Activated' : ''}
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor: theme === 'dark' ? 'black' : 'white'
                                    }}
                                    onPress={() => navigation.navigate('AddEditNode', { node: item, index: index })}
                                    titleStyle={{ color: theme === 'dark' ? 'white' : 'black' }}
                                    subtitleStyle={{ color: theme === 'dark' ? 'gray' : '#8a8999' }}
                                />
                            </React.Fragment>
                        );
                    }}
                    keyExtractor={(item, index) => `${item.host}-${index}`}
                    ItemSeparatorComponent={this.renderSeparator}
                    onEndReachedThreshold={50}
                />}
                {(nodes && nodes.length === 0) && !loading && <Button
                    title="No Nodes"
                    icon={{
                        name: "error-outline",
                        size: 25,
                        color: theme === 'dark' ? 'white' : 'black'
                    }}
                    buttonStyle={{
                        backgroundColor: "transparent",
                        borderRadius: 30
                    }}
                    titleStyle={{
                        color: theme === 'dark' ? 'white' : 'black'
                    }}
                />}
                <Button
                    title="Add a new node"
                    icon={{
                        name: "add",
                        size: 25,
                        color: 'white'
                    }}
                    buttonStyle={{
                        borderRadius: 30,
                        width: 200,
                        alignSelf: 'center'
                    }}
                    onPress={() => navigation.navigate('AddEditNode', { index: nodes && nodes.length && Number(nodes.length) || 0 })}
                    titleStyle={{
                        color: 'white'
                    }}
                />
            </View>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        minHeight: 100
    },
    darkThemeStyle: {
        minHeight: 100,
        backgroundColor: 'black',
        color: 'white'
    },
    lightSeparator: {
        height: 1,
        width: "86%",
        backgroundColor: "#CED0CE",
        marginLeft: "14%"
    },
    darkSeparator: {
        height: 1,
        width: "86%",
        backgroundColor: "darkgray",
        marginLeft: "14%"
    },
    button: {
        paddingTop: 15,
        paddingBottom: 10
    }
});