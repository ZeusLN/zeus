import * as React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    StyleSheet,
    FlatListProps
} from 'react-native';

import DragList, { DragListRenderItemInfo } from 'react-native-draglist';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import cloneDeep from 'lodash/cloneDeep';

import Button from '../../components/Button';
import Header from '../../components/Header';
import NodeIdenticon, { NodeTitle } from '../../components/NodeIdenticon';
import Screen from '../../components/Screen';
import LoadingIndicator from '../../components/LoadingIndicator';

import SettingsStore, {
    INTERFACE_KEYS,
    Node
} from '../../stores/SettingsStore';

import { getPhoto } from '../../utils/PhotoUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import BackendUtils from '../../utils/BackendUtils';

import Add from '../../assets/images/SVG/Add.svg';
import DragDots from '../../assets/images/SVG/DragDots.svg';

interface Props<T> extends Omit<FlatListProps<T>, 'renderItem'> {
    data: T[];
    keyExtractor: (item: T, index: number) => string;
    renderItem: (info: DragListRenderItemInfo<T>) => React.ReactElement | null;
    onReordered?: (fromIndex: number, toIndex: number) => Promise<void> | void;
}

interface NodesProps {
    nodes: any[];
    navigation: StackNavigationProp<any, any>;
    edit?: boolean;
    loading?: boolean;
    selectedNode?: number;
    SettingsStore: SettingsStore;
}

interface NodesState {
    nodes: any[];
    selectedNode: number;
    loading: boolean;
}

const TypedDragList = DragList as unknown as React.ComponentType<Props<Node>>;

@inject('SettingsStore')
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

        this.props.navigation.addListener('focus', this.handleFocus);
    }

    componentWillUnmount() {
        this.props.navigation.removeListener &&
            this.props.navigation.removeListener('focus', this.handleFocus);
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
        await this.props.SettingsStore.getSettings().then((settings) => {
            this.setState({
                loading: false,
                nodes: settings?.nodes || [],
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
        const { navigation, SettingsStore } = this.props;
        const { loading, nodes, selectedNode } = this.state;
        const {
            updateSettings,
            setConnectingStatus,
            setInitialStart,
            implementation
        }: any = SettingsStore;

        const implementationDisplayValue: { [key: string]: string } = {};

        INTERFACE_KEYS.forEach((item) => {
            implementationDisplayValue[item.value] = item.key;
        });

        const AddButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('WalletConfiguration', {
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
                        text: localeString('views.Settings.Wallets.title'),
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
                    <View style={{ marginBottom: 50 }}>
                        <TypedDragList
                            onReordered={onReordered}
                            data={nodes}
                            keyExtractor={(item, index) => {
                                return JSON.stringify(item) + index;
                            }}
                            // keyExtractor={(item) => item}
                            renderItem={({
                                item,
                                index,
                                onDragStart,
                                onDragEnd
                            }: DragListRenderItemInfo<any>) => {
                                let nodeSubtitle = '';
                                const nodeActive =
                                    selectedNode === index ||
                                    (!selectedNode && index === 0);
                                if (nodeActive) {
                                    nodeSubtitle = `${localeString(
                                        'general.active'
                                    )} | `;
                                }

                                nodeSubtitle +=
                                    implementationDisplayValue[
                                        item.implementation
                                    ];

                                if (
                                    item.implementation === 'embedded-lnd' &&
                                    item.embeddedLndNetwork
                                ) {
                                    nodeSubtitle += ` (${item.embeddedLndNetwork})`;
                                }

                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={{
                                            borderBottomWidth: 0,
                                            backgroundColor: nodeActive
                                                ? // match the LayerBalance sliders
                                                  themeColor(
                                                      'buttonBackground'
                                                  ) || themeColor('secondary')
                                                : 'transparent'
                                        }}
                                        onPress={async () => {
                                            const currentImplementation =
                                                implementation;
                                            if (
                                                currentImplementation ===
                                                'lightning-node-connect'
                                            ) {
                                                BackendUtils.disconnect();
                                            }
                                            await updateSettings({
                                                nodes,
                                                selectedNode: index
                                            }).then(() => {
                                                setConnectingStatus(true);
                                                setInitialStart(false);
                                                navigation.popTo('Wallet');
                                            });
                                        }}
                                    >
                                        <ListItem
                                            containerStyle={{
                                                borderBottomWidth: 0,
                                                backgroundColor: 'transparent'
                                            }}
                                        >
                                            {item.photo ? (
                                                <Image
                                                    source={{
                                                        uri: getPhoto(
                                                            item.photo
                                                        )
                                                    }}
                                                    style={styles.photo}
                                                />
                                            ) : (
                                                <NodeIdenticon
                                                    selectedNode={item}
                                                    width={42}
                                                    rounded
                                                />
                                            )}

                                            <ListItem.Content>
                                                <ListItem.Title
                                                    style={{
                                                        color: nodeActive
                                                            ? themeColor(
                                                                  'buttonText'
                                                              )
                                                            : themeColor(
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
                                                        color: nodeActive
                                                            ? themeColor(
                                                                  'buttonText'
                                                              )
                                                            : themeColor(
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
                                                        color: nodeActive
                                                            ? themeColor(
                                                                  'buttonText'
                                                              )
                                                            : themeColor('text')
                                                    }}
                                                    onPress={() =>
                                                        navigation.navigate(
                                                            'WalletConfiguration',
                                                            {
                                                                node: cloneDeep(
                                                                    item
                                                                ),
                                                                index,
                                                                active: nodeActive,
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
                                                            fill={
                                                                nodeActive
                                                                    ? themeColor(
                                                                          'buttonText'
                                                                      )
                                                                    : themeColor(
                                                                          'text'
                                                                      )
                                                            }
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
                            {localeString('views.Settings.Wallets.noWallets')}
                        </Text>
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    photo: {
        alignSelf: 'center',
        width: 42,
        height: 42,
        borderRadius: 68
    }
});
