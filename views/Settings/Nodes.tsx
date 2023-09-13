import * as React from 'react';
import { FlatList, View, Text } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Button from '../../components/Button';
import Header from '../../components/Header';
import NodeIdenticon, { NodeTitle } from '../../components/NodeIdenticon';
import Screen from '../../components/Screen';

import BackendUtils from '../../utils/BackendUtils';
import BalanceStore from '../../stores/BalanceStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore, { INTERFACE_KEYS } from '../../stores/SettingsStore';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import ChannelsStore from '../../stores/ChannelsStore';

interface NodesProps {
    nodes: any[];
    navigation: any;
    edit?: boolean;
    loading?: boolean;
    selectedNode?: number;
    BalanceStore: BalanceStore;
    NodeInfoStore: NodeInfoStore;
    ChannelsStore: ChannelsStore;
    SettingsStore: SettingsStore;
}

interface NodesState {
    nodes: any[];
    loading: boolean;
}

@inject('BalanceStore', 'NodeInfoStore', 'ChannelsStore', 'SettingsStore')
@observer
export default class Nodes extends React.Component<NodesProps, NodesState> {
    state = {
        nodes: [],
        loading: false
    };

    UNSAFE_componentWillMount() {
        this.refreshSettings();

        this.props.navigation.addListener('didFocus', () => {
            this.refreshSettings();
        });
    }

    componentWillUnmount() {
        this.props.navigation.removeListener &&
            this.props.navigation.removeListener('didFocus');
    }

    UNSAFE_componentWillReceiveProps = () => {
        this.refreshSettings();
    };

    async refreshSettings() {
        this.setState({
            loading: true
        });
        await this.props.SettingsStore.getSettings().then((settings: any) => {
            this.setState({
                loading: false,
                nodes: (settings && settings.nodes) || []
            });
        });
    }

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

    render() {
        const {
            navigation,
            BalanceStore,
            NodeInfoStore,
            ChannelsStore,
            SettingsStore
        } = this.props;
        const { loading, nodes } = this.state;
        const {
            updateSettings,
            settings,
            setConnectingStatus,
            implementation
        }: any = SettingsStore;
        const { selectedNode } = settings;

        const implementationDisplayValue = {};
        INTERFACE_KEYS.forEach((item) => {
            implementationDisplayValue[item.value] = item.key;
        });

        const AddButton = () => (
            <Icon
                name="add"
                onPress={() =>
                    navigation.navigate('NodeConfiguration', {
                        newEntry: true,
                        index:
                            (nodes && nodes.length && Number(nodes.length)) || 0
                    })
                }
                color={themeColor('text')}
                underlayColor="transparent"
                size={30}
                accessibilityLabel={localeString('general.add')}
            />
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Nodes.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    rightComponent={<AddButton />}
                    navigation={navigation}
                />
                {!!nodes && nodes.length > 0 && (
                    <FlatList
                        data={nodes}
                        renderItem={({
                            item,
                            index
                        }: {
                            item: any;
                            index: number;
                        }) => {
                            let nodeSubtitle = '';
                            if (
                                selectedNode === index ||
                                (!selectedNode && index === 0)
                            ) {
                                nodeSubtitle = 'Active | ';
                            }

                            nodeSubtitle +=
                                implementationDisplayValue[item.implementation];

                            if (item.embeddedLndNetwork) {
                                nodeSubtitle += ` (${item.embeddedLndNetwork})`;
                            }

                            return (
                                <ListItem
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor: 'transparent'
                                    }}
                                    onPress={async () => {
                                        const currentImplementation =
                                            implementation;
                                        await updateSettings({
                                            nodes,
                                            selectedNode: index
                                        }).then(() => {
                                            if (
                                                currentImplementation ===
                                                'lightning-node-connect'
                                            ) {
                                                BackendUtils.disconnect();
                                            }
                                            BalanceStore.reset();
                                            NodeInfoStore.reset();
                                            ChannelsStore.reset();
                                            setConnectingStatus(true);
                                            navigation.navigate('Wallet', {
                                                refresh: true
                                            });
                                        });
                                    }}
                                >
                                    <NodeIdenticon
                                        selectedNode={item}
                                        width={35}
                                        rounded
                                    />
                                    <ListItem.Content>
                                        <ListItem.Title
                                            style={{
                                                color: themeColor('text'),
                                                fontFamily: 'Lato-Regular'
                                            }}
                                        >
                                            {NodeTitle(item, 32)}
                                        </ListItem.Title>
                                        <ListItem.Subtitle
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontFamily: 'Lato-Regular'
                                            }}
                                        >
                                            {nodeSubtitle}
                                        </ListItem.Subtitle>
                                    </ListItem.Content>
                                    <Button
                                        title=""
                                        accessibilityLabel={localeString(
                                            'views.Settings.Language.title'
                                        )}
                                        icon={{
                                            name: 'settings',
                                            size: 25,
                                            color: themeColor('text')
                                        }}
                                        onPress={() =>
                                            navigation.navigate(
                                                'NodeConfiguration',
                                                {
                                                    node: item,
                                                    index,
                                                    active:
                                                        selectedNode === index,
                                                    saved: true
                                                }
                                            )
                                        }
                                        iconOnly
                                        adaptiveWidth
                                    />
                                </ListItem>
                            );
                        }}
                        refreshing={loading}
                        keyExtractor={(item, index) => `${item.host}-${index}`}
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                    />
                )}
                {nodes && nodes.length === 0 && !loading && (
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'center',
                            alignItems: 'center',
                            paddingVertical: 15,
                            paddingHorizontal: 10
                        }}
                    >
                        <Icon
                            name="error-outline"
                            size={25}
                            color={themeColor('text')}
                        />
                        <Text style={{ color: themeColor('text') }}>
                            {localeString('views.Settings.Nodes.noNodes')}
                        </Text>
                    </View>
                )}
            </Screen>
        );
    }
}
