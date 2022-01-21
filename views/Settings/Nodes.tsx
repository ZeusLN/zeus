import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Avatar, Header, Icon, ListItem } from 'react-native-elements';
import Identicon from 'identicon.js';
import { inject, observer } from 'mobx-react';

import Button from './../../components/Button';
import SettingsStore from './../../stores/SettingsStore';
import PrivacyUtils from './../../utils/PrivacyUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
const hash = require('object-hash');

interface NodesProps {
    nodes: any[];
    navigation: any;
    edit?: boolean;
    loading?: boolean;
    selectedNode?: number;
    SettingsStore: SettingsStore;
}

interface NodesState {
    nodes: any[];
    loading: boolean;
}

@inject('SettingsStore')
@observer
export default class Nodes extends React.Component<NodesProps, NodesState> {
    state = {
        nodes: [],
        loading: false
    };

    renderSeparator = () => (
        <View
            style={{
                height: 1,
                width: '86%',
                backgroundColor: themeColor('separator'),
                marginLeft: '14%'
            }}
        />
    );

    componentDidMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;
        this.refreshSettings();

        if (settings) {
            this.setState({
                nodes: settings.nodes || []
            });
        }
    }

    async refreshSettings() {
        this.setState({
            loading: true
        });
        await this.props.SettingsStore.getSettings().then(() => {
            this.setState({
                loading: false
            });
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { loading, nodes } = this.state;
        const { setSettings, settings }: any = SettingsStore;
        const { selectedNode } = settings;

        const Node = (balanceImage: string) => (
            <Avatar
                source={{
                    uri: balanceImage
                }}
                rounded
            />
        );

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <View>
                    <Header
                        leftComponent={<BackButton />}
                        centerComponent={{
                            text: localeString('views.Settings.Nodes.title'),
                            style: { color: themeColor('text') }
                        }}
                        backgroundColor={themeColor('secondary')}
                    />
                    {!!nodes && nodes.length > 0 && (
                        <FlatList
                            data={nodes}
                            renderItem={({ item, index }) => {
                                const displayName = item.nickname
                                    ? item.nickname
                                    : item.implementation === 'lndhub'
                                    ? item.lndhubUrl
                                          .replace('https://', '')
                                          .replace('http://', '')
                                    : item.url
                                    ? item.url
                                          .replace('https://', '')
                                          .replace('http://', '')
                                    : item.port
                                    ? `${item.host}:${item.port}`
                                    : item.host || 'Unknown';

                                const title = PrivacyUtils.sensitiveValue(
                                    displayName,
                                    8
                                );
                                const implementation =
                                    PrivacyUtils.sensitiveValue(
                                        item.implementation || 'lnd',
                                        8
                                    );

                                const data = new Identicon(
                                    hash.sha1(
                                        item.implementation === 'lndhub'
                                            ? `${title}-${item.username}`
                                            : title
                                    ),
                                    255
                                ).toString();

                                return (
                                    <ListItem
                                        title={`${title}`}
                                        leftElement={Node(
                                            `data:image/png;base64,${data}`
                                        )}
                                        rightElement={
                                            <Button
                                                title=""
                                                icon={{
                                                    name: 'settings',
                                                    size: 25,
                                                    color: themeColor('text')
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
                                                iconOnly
                                                adaptiveWidth
                                            />
                                        }
                                        subtitle={
                                            selectedNode === index ||
                                            (!selectedNode && index === 0)
                                                ? `Active | ${implementation}`
                                                : `${implementation}`
                                        }
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor:
                                                themeColor('background')
                                        }}
                                        onPress={() => {
                                            setSettings(
                                                JSON.stringify({
                                                    nodes,
                                                    theme: settings.theme,
                                                    selectedNode: index,
                                                    fiat: settings.fiat,
                                                    passphrase:
                                                        settings.passphrase,
                                                    privacy: settings.privacy
                                                })
                                            ).then(() => {
                                                navigation.navigate('Wallet', {
                                                    refresh: true
                                                });
                                            });
                                        }}
                                        titleStyle={{
                                            color: themeColor('text')
                                        }}
                                        subtitleStyle={{
                                            color: themeColor('secondaryText')
                                        }}
                                    />
                                );
                            }}
                            refreshing={loading}
                            keyExtractor={(item, index) =>
                                `${item.host}-${index}`
                            }
                            ItemSeparatorComponent={this.renderSeparator}
                            onEndReachedThreshold={50}
                        />
                    )}
                    {nodes && nodes.length === 0 && !loading && (
                        <Button
                            title={localeString('views.Settings.Nodes.noNodes')}
                            icon={{
                                name: 'error-outline',
                                size: 25,
                                color: themeColor('text')
                            }}
                            iconOnly
                        />
                    )}
                    {!loading && (
                        <Button
                            title={localeString('views.Settings.Nodes.add')}
                            icon={{
                                name: 'add',
                                size: 25,
                                color: 'white'
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
                            adaptiveWidth
                        />
                    )}
                </View>
            </View>
        );
    }
}
