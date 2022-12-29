import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Button from './../../components/Button';
import LoadingIndicator from './../../components/LoadingIndicator';
import NodeIdenticon, { NodeTitle } from './../../components/NodeIdenticon';

import BackendUtils from './../../utils/BackendUtils';
import BalanceStore from './../../stores/BalanceStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore, { INTERFACE_KEYS } from './../../stores/SettingsStore';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

interface NodesProps {
    nodes: any[];
    navigation: any;
    edit?: boolean;
    loading?: boolean;
    selectedNode?: number;
    BalanceStore: BalanceStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
}

interface NodesState {
    nodes: any[];
    loading: boolean;
}

@inject('BalanceStore', 'NodeInfoStore', 'SettingsStore')
@observer
export default class Nodes extends React.Component<NodesProps, NodesState> {
    state = {
        nodes: [],
        loading: false
    };

    componentDidMount() {
        this.refreshSettings();
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
        const { navigation, BalanceStore, NodeInfoStore, SettingsStore } =
            this.props;
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

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        const AddButton = () => (
            <Icon
                name="add"
                onPress={() =>
                    navigation.navigate('AddEditNode', {
                        newEntry: true,
                        index:
                            (nodes && nodes.length && Number(nodes.length)) || 0
                    })
                }
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
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        rightComponent={<AddButton />}
                        backgroundColor={themeColor('background')}
                        containerStyle={{
                            borderBottomWidth: 0
                        }}
                    />
                    {!!nodes && nodes.length > 0 && (
                        <FlatList
                            data={nodes}
                            renderItem={({ item, index }) => (
                                <ListItem
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor:
                                            themeColor('background')
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
                                            {selectedNode === index ||
                                            (!selectedNode && index === 0)
                                                ? `Active | ${
                                                      implementationDisplayValue[
                                                          item.implementation
                                                      ]
                                                  }`
                                                : `${
                                                      implementationDisplayValue[
                                                          item.implementation
                                                      ]
                                                  }`}
                                        </ListItem.Subtitle>
                                    </ListItem.Content>
                                    <Button
                                        title=""
                                        icon={{
                                            name: 'settings',
                                            size: 25,
                                            color: themeColor('text')
                                        }}
                                        onPress={() =>
                                            navigation.navigate('AddEditNode', {
                                                node: item,
                                                index,
                                                active: selectedNode === index,
                                                saved: true
                                            })
                                        }
                                        iconOnly
                                        adaptiveWidth
                                    />
                                </ListItem>
                            )}
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
                    {loading && <LoadingIndicator />}
                </View>
            </View>
        );
    }
}
