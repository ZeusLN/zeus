import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Button from './../../components/Button';
import NodeIdenticon, { NodeTitle } from './../../components/NodeIdenticon';
import SettingsStore from './../../stores/SettingsStore';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

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
        const { navigation, SettingsStore } = this.props;
        const { loading, nodes } = this.state;
        const { setSettings, settings, setConnectingStatus }: any =
            SettingsStore;
        const { selectedNode } = settings;

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
                                    onPress={() => {
                                        setSettings(
                                            JSON.stringify({
                                                nodes,
                                                theme: settings.theme,
                                                selectedNode: index,
                                                fiat: settings.fiat,
                                                passphrase: settings.passphrase,
                                                privacy: settings.privacy
                                            })
                                        ).then(() => {
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
                                                ? `Active | ${item.implementation}`
                                                : `${item.implementation}`}
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
                </View>
            </View>
        );
    }
}
