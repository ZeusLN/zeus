import * as React from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Button from '../../../../components/Button';
import Header from '../../../../components/Header';
import Text from '../../../../components/Text';
import TextInput from '../../../../components/TextInput';
import Screen from '../../../../components/Screen';
import Switch from '../../../../components/Switch';
import { Row } from '../../../../components/layout/Row';

import SettingsStore from '../../../../stores/SettingsStore';

import { localeString } from '../../../../utils/LocaleUtils';
import { restartNeeded } from '../../../../utils/RestartUtils';
import { themeColor } from '../../../../utils/ThemeUtils';

interface NeutrinoPeersProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface NeutrinoPeersState {
    dontAllowOtherPeers: boolean | undefined;
    neutrinoPeers: Array<string>;
    addPeer: string;
}

@inject('SettingsStore')
@observer
export default class NeutrinoPeers extends React.Component<
    NeutrinoPeersProps,
    NeutrinoPeersState
> {
    state = {
        dontAllowOtherPeers: false,
        neutrinoPeers: [],
        addPeer: ''
    };

    remove = (arrOriginal, elementToRemove) => {
        return arrOriginal.filter(function (el) {
            return el !== elementToRemove;
        });
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.setState({
            dontAllowOtherPeers:
                settings.dontAllowOtherPeers !== undefined
                    ? settings.dontAllowOtherPeers
                    : false,
            neutrinoPeers: settings.neutrinoPeers || []
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { dontAllowOtherPeers, neutrinoPeers, addPeer } = this.state;
        const { updateSettings }: any = SettingsStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.NeutrinoPeers.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <ScrollView style={{ margin: 5 }}>
                        <>
                            <View
                                style={{
                                    margin: 10
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {`${localeString(
                                        'general.note'
                                    ).toUpperCase()}: ${localeString(
                                        'general.restartZeusChanges'
                                    ).replace('Zeus', 'ZEUS')}`}
                                </Text>
                            </View>
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: 'transparent'
                                }}
                            >
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.NeutrinoPeers.allowOtherPeers'
                                    )}
                                </ListItem.Title>
                                <View
                                    style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        justifyContent: 'flex-end'
                                    }}
                                >
                                    <Switch
                                        value={!dontAllowOtherPeers}
                                        onValueChange={async () => {
                                            this.setState({
                                                dontAllowOtherPeers:
                                                    !dontAllowOtherPeers
                                            });
                                            await updateSettings({
                                                dontAllowOtherPeers:
                                                    !dontAllowOtherPeers
                                            });
                                            restartNeeded();
                                        }}
                                    />
                                </View>
                            </ListItem>
                            <View
                                style={{
                                    margin: 10
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.NeutrinoPeers.allowOtherPeers.subtitle1'
                                    )}
                                </Text>
                            </View>
                            <View
                                style={{
                                    margin: 10
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.NeutrinoPeers.allowOtherPeers.subtitle2'
                                    )}
                                </Text>
                            </View>
                        </>
                        <View style={{ margin: 5 }}>
                            <Text>
                                {localeString(
                                    'views.Settings.EmbeddedNode.Peers.addPeer'
                                )}
                            </Text>
                            <Row align="flex-end">
                                <TextInput
                                    placeholder="btcd.lnolymp.us"
                                    onChangeText={(text: string) =>
                                        this.setState({ addPeer: text })
                                    }
                                    value={addPeer}
                                    style={{ flex: 1 }}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                <View style={{ width: 50, height: 60 }}>
                                    <Button
                                        icon={{
                                            name: 'plus',
                                            type: 'font-awesome',
                                            size: 25,
                                            color: themeColor('text')
                                        }}
                                        iconOnly
                                        onPress={() => {
                                            if (!addPeer) return;
                                            const newNeutrinoPeers = [
                                                ...neutrinoPeers,
                                                addPeer
                                            ];
                                            this.setState({
                                                neutrinoPeers: newNeutrinoPeers,
                                                addPeer: ''
                                            });
                                            updateSettings({
                                                neutrinoPeers: newNeutrinoPeers
                                            });
                                        }}
                                    />
                                </View>
                            </Row>
                            <Text>
                                {localeString(
                                    'views.Settings.EmbeddedNode.Peers.peersList'
                                )}
                            </Text>
                            {neutrinoPeers && neutrinoPeers.length > 0 ? (
                                <FlatList
                                    data={neutrinoPeers}
                                    renderItem={({ item }: any) => (
                                        <Row align="flex-end">
                                            <TextInput
                                                value={item}
                                                style={{ flex: 1 }}
                                                autoCapitalize="none"
                                                locked
                                            />
                                            <View
                                                style={{
                                                    alignSelf: 'flex-end',
                                                    width: 50,
                                                    height: 60
                                                }}
                                            >
                                                <Button
                                                    icon={{
                                                        name: 'minus',
                                                        type: 'font-awesome',
                                                        size: 25,
                                                        color: themeColor(
                                                            'text'
                                                        )
                                                    }}
                                                    iconOnly
                                                    onPress={() => {
                                                        const newNeutrinoPeers =
                                                            this.remove(
                                                                neutrinoPeers,
                                                                item
                                                            );
                                                        this.setState({
                                                            neutrinoPeers:
                                                                newNeutrinoPeers
                                                        });
                                                        updateSettings({
                                                            neutrinoPeers:
                                                                newNeutrinoPeers
                                                        });
                                                    }}
                                                />
                                            </View>
                                        </Row>
                                    )}
                                    keyExtractor={(item: any, index: number) =>
                                        `${item.txid}-${index}`
                                    }
                                    onEndReachedThreshold={50}
                                />
                            ) : (
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        marginTop: 15
                                    }}
                                >{`${localeString(
                                    'general.noneSelected'
                                )}. ${localeString(
                                    'general.zeusDefaults'
                                ).replace('Zeus', 'ZEUS')}.`}</Text>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
