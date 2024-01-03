import * as React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import DragList, { DragListRenderItemInfo } from 'react-native-draglist';
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

import Add from '../../assets/images/SVG/Add.svg';
import DragDots from '../../assets/images/SVG/DragDots.svg';
import LoadingIndicator from '../../components/LoadingIndicator';

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
    selectedNode: number;
    loading: boolean;
}

@inject('BalanceStore', 'NodeInfoStore', 'ChannelsStore', 'SettingsStore')
@observer
export default class Nodes extends React.Component<NodesProps, NodesState> {
    isInitialFocus = true;

    state = {
        nodes: [],
        selectedNode: 0,
        loading: false
    };

    componentDidMount() {
        this.refreshSettings();

        this.props.navigation.addListener('didFocus', this.handleFocus);
    }

    componentWillUnmount() {
        this.props.navigation.removeListener &&
            this.props.navigation.removeListener('didFocus');
    }

    handleFocus = () => {
        if (this.isInitialFocus) {
            this.isInitialFocus = false;
        } else {
            this.refreshSettings();
        }
    };

    async refreshSettings() {
        this.setState({
            loading: true
        });
        await this.props.SettingsStore.getSettings().then((settings: any) => {
            this.setState({
                loading: false,
                nodes: (settings && settings.nodes) || [],
                selectedNode: (settings && settings.selectedNode) || 0
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
        const { loading, nodes, selectedNode } = this.state;
        const { updateSettings, setConnectingStatus, implementation }: any =
            SettingsStore;

        const implementationDisplayValue = {};
        INTERFACE_KEYS.forEach((item) => {
            implementationDisplayValue[item.value] = item.key;
        });

        const AddButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('NodeConfiguration', {
                        newEntry: true,
                        index:
                            (nodes && nodes.length && Number(nodes.length)) || 0
                    })
                }
                accessibilityLabel={localeString('general.add')}
            >
                <Add
                    fill={themeColor('text')}
                    width="30"
                    height="30"
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        const onReordered = async (fromIndex: number, toIndex: number) => {
            const oldSelectedNode =
                this.props.SettingsStore?.settings?.selectedNode || 0;
            let selectedNode = oldSelectedNode;

            if (oldSelectedNode >= fromIndex && oldSelectedNode <= toIndex) {
                selectedNode--;
            }

            if (oldSelectedNode <= fromIndex && oldSelectedNode >= toIndex) {
                selectedNode++;
            }

            if (fromIndex === oldSelectedNode) {
                selectedNode = toIndex;
            }

            const copy = [...nodes]; // Don't modify react data in-place
            const removed = copy.splice(fromIndex, 1);

            copy.splice(toIndex, 0, removed[0]); // Now insert at the new pos
            this.setState({
                nodes: copy,
                selectedNode
            });
            updateSettings({
                nodes: copy,
                selectedNode
            });
        };

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Nodes.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={<AddButton />}
                    navigation={navigation}
                />
                {loading && <LoadingIndicator />}
                {!loading && !!nodes && nodes.length > 0 && (
                    <View>
                        <DragList
                            onReordered={onReordered}
                            data={nodes}
                            keyExtractor={(item: any) => {
                                return JSON.stringify(item);
                            }}
                            // keyExtractor={(item) => item}
                            renderItem={({
                                item,
                                index,
                                onDragStart,
                                onDragEnd,
                                isActive
                            }: DragListRenderItemInfo<any>) => {
                                let nodeSubtitle = '';
                                if (
                                    selectedNode === index ||
                                    (!selectedNode && index === 0)
                                ) {
                                    nodeSubtitle = 'Active | ';
                                }

                                nodeSubtitle +=
                                    implementationDisplayValue[
                                        item.implementation
                                    ];

                                if (item.embeddedLndNetwork) {
                                    nodeSubtitle += ` (${item.embeddedLndNetwork})`;
                                }

                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={{
                                            borderBottomWidth: 0,
                                            backgroundColor: isActive
                                                ? themeColor('highlight')
                                                : themeColor('background')
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
                                        <ListItem
                                            containerStyle={{
                                                borderBottomWidth: 0,
                                                backgroundColor: 'transparent'
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
                                                        color: themeColor(
                                                            'text'
                                                        ),
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    {NodeTitle(item, 32)}
                                                </ListItem.Title>
                                                <ListItem.Subtitle
                                                    style={{
                                                        color: themeColor(
                                                            'secondaryText'
                                                        ),
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    {nodeSubtitle}
                                                </ListItem.Subtitle>
                                            </ListItem.Content>
                                            <>
                                                <Button
                                                    title=""
                                                    accessibilityLabel={localeString(
                                                        'views.Settings.title'
                                                    )}
                                                    icon={{
                                                        name: 'settings',
                                                        size: 35,
                                                        color: themeColor(
                                                            'text'
                                                        )
                                                    }}
                                                    onPress={() =>
                                                        navigation.navigate(
                                                            'NodeConfiguration',
                                                            {
                                                                node: item,
                                                                index,
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
                                                {nodes.length > 1 && (
                                                    <TouchableOpacity
                                                        onPressIn={onDragStart}
                                                        onPressOut={onDragEnd}
                                                        accessibilityLabel={localeString(
                                                            'general.reorder'
                                                        )}
                                                    >
                                                        <DragDots
                                                            fill={themeColor(
                                                                'text'
                                                            )}
                                                            width="30"
                                                            height="30"
                                                            style={{
                                                                alignSelf:
                                                                    'center'
                                                            }}
                                                        />
                                                    </TouchableOpacity>
                                                )}
                                            </>
                                        </ListItem>
                                    </TouchableOpacity>
                                );
                            }}
                            refreshing={loading}
                            ItemSeparatorComponent={this.renderSeparator}
                            onEndReachedThreshold={50}
                        />
                    </View>
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
