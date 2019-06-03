import * as React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Avatar, Button, ListItem } from 'react-native-elements';
import Identicon from 'identicon.js';
const hash = require('object-hash');

interface NodesProps {
    nodes: any[];
    navigation: any;
    edit?: boolean;
    loading?: boolean;
    theme?: string;
    selectedNode?: number;
}

export default class Nodes extends React.Component<NodesProps, {}> {
    renderSeparator = () => {
        const { theme } = this.props;
        return (
            <View style={theme === 'dark' ? styles.darkSeparator : styles.lightSeparator} />
        )
    }

    render() {
        const { navigation, nodes, theme, loading, selectedNode } = this.props;
        const Node = (balanceImage: string) => (
            <Avatar
                source={{
                    uri: balanceImage
                }}
            />
        );

        return (
            <View>
                {(!!nodes && !loading && nodes.length > 0) && <FlatList
                    data={nodes}
                    renderItem={({ item, index }) => {
                        const data = new Identicon(hash.sha1(item.host), 420).toString();
                        return (
                            <React.Fragment>
                                <ListItem
                                    title={item.host}
                                    leftElement={Node(`data:image/png;base64,${data}`)}
                                    subtitle={selectedNode === index ? 'Active' : ''}
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor: theme === 'dark' ? 'black' : 'white'
                                    }}
                                    onPress={() => navigation.navigate('AddEditNode', { node: item, index: index, active: selectedNode === index })}
                                    titleStyle={{ color: theme === 'dark' ? 'white' : 'black' }}
                                    subtitleStyle={{ color: theme === 'dark' ? 'gray' : '#8a8999' }}
                                />
                            </React.Fragment>
                        );
                    }}
                    refreshing={loading}
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
                {!loading && <Button
                    title="Add a new node"
                    icon={{
                        name: "add",
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
                    onPress={() => navigation.navigate('AddEditNode', { index: nodes && nodes.length && Number(nodes.length) || 0 })}
                    titleStyle={{
                        color: 'white'
                    }}
                />}
            </View>
        );
    }
}

const styles = StyleSheet.create({
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