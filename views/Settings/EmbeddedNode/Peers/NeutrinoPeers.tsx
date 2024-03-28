import * as React from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Ping from 'react-native-ping';

import Button from '../../../../components/Button';
import Header from '../../../../components/Header';
import Text from '../../../../components/Text';
import TextInput from '../../../../components/TextInput';
import Screen from '../../../../components/Screen';
import Switch from '../../../../components/Switch';
import { Row } from '../../../../components/layout/Row';
import {
    SuccessMessage,
    WarningMessage,
    ErrorMessage
} from '../../../../components/SuccessErrorMessage';

import SettingsStore, {
    DEFAULT_NEUTRINO_PEERS_MAINNET,
    DEFAULT_NEUTRINO_PEERS_TESTNET
} from '../../../../stores/SettingsStore';

import { localeString } from '../../../../utils/LocaleUtils';
import { restartNeeded } from '../../../../utils/RestartUtils';
import { themeColor } from '../../../../utils/ThemeUtils';
import LoadingIndicator from '../../../../components/LoadingIndicator';

interface NeutrinoPeersProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface NeutrinoPeersState {
    dontAllowOtherPeers: boolean | undefined;
    neutrinoPeers: Array<string>;
    addPeer: string;
    pingTime: number;
    pingTimeout: boolean;
    pingHost: string;
    pinging: boolean;
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
        addPeer: '',
        pingTime: 0,
        pingTimeout: false,
        pingHost: '',
        pinging: false
    };

    remove = (arrOriginal, elementToRemove) => {
        return arrOriginal.filter(function (el) {
            return el !== elementToRemove;
        });
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings, embeddedLndNetwork } = SettingsStore;
        this.setState({
            dontAllowOtherPeers:
                settings.dontAllowOtherPeers !== undefined
                    ? settings.dontAllowOtherPeers
                    : false,
            neutrinoPeers:
                embeddedLndNetwork === 'Testnet'
                    ? settings.neutrinoPeersTestnet
                    : settings.neutrinoPeersMainnet
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            dontAllowOtherPeers,
            neutrinoPeers,
            addPeer,
            pingTime,
            pingTimeout,
            pingHost,
            pinging
        } = this.state;
        const { updateSettings, embeddedLndNetwork }: any = SettingsStore;

        const mainnetPeersChanged =
            embeddedLndNetwork === 'Mainnet' &&
            JSON.stringify(neutrinoPeers) !==
                JSON.stringify(DEFAULT_NEUTRINO_PEERS_MAINNET);

        const testnetPeersChanged =
            embeddedLndNetwork === 'Testnet' &&
            JSON.stringify(neutrinoPeers) !==
                JSON.stringify(DEFAULT_NEUTRINO_PEERS_TESTNET);

        const pingTimeMsg = `${pingHost}: ${pingTime}ms`;

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
                    <View style={{ flex: 1 }}>
                        {pinging && <LoadingIndicator />}
                        {!pingTimeout &&
                            !pinging &&
                            pingHost &&
                            pingTime <= 100 && (
                                <SuccessMessage
                                    message={pingTimeMsg}
                                    dismissable
                                />
                            )}
                        {!pingTimeout &&
                            !pinging &&
                            pingHost &&
                            pingTime < 200 &&
                            pingTime > 100 && (
                                <WarningMessage
                                    message={pingTimeMsg}
                                    dismissable
                                />
                            )}
                        {!pingTimeout &&
                            !pinging &&
                            pingHost &&
                            pingTime >= 200 && (
                                <ErrorMessage
                                    message={pingTimeMsg}
                                    dismissable
                                />
                            )}
                        {!pinging && pingHost && !!pingTimeout && (
                            <ErrorMessage
                                message={`${pingHost}: ${localeString(
                                    'views.Settings.EmbeddedNode.NeutrinoPeers.timedOut'
                                )}`}
                                dismissable
                            />
                        )}
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
                                            'views.Settings.EmbeddedNode.NeutrinoPeers.dontAllowOtherPeers'
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
                                            value={dontAllowOtherPeers}
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
                                            'views.Settings.EmbeddedNode.NeutrinoPeers.dontAllowOtherPeers.subtitle'
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
                                    <Row>
                                        <View
                                            style={{
                                                width: 50,
                                                height: 60
                                            }}
                                        >
                                            <Button
                                                icon={{
                                                    name: 'hourglass',
                                                    type: 'font-awesome',
                                                    size: 25,
                                                    color: !addPeer
                                                        ? themeColor(
                                                              'secondaryText'
                                                          )
                                                        : themeColor('text')
                                                }}
                                                iconOnly
                                                onPress={async () => {
                                                    if (!addPeer) return;
                                                    try {
                                                        this.setState({
                                                            pingTime: 0,
                                                            pingTimeout: false,
                                                            pingHost: addPeer,
                                                            pinging: true
                                                        });

                                                        const ms =
                                                            await Ping.start(
                                                                addPeer,
                                                                {
                                                                    timeout: 1000
                                                                }
                                                            );
                                                        this.setState({
                                                            pingTime: ms,
                                                            pinging: false
                                                        });
                                                    } catch (e) {
                                                        this.setState({
                                                            pingTimeout: true,
                                                            pinging: false
                                                        });
                                                    }
                                                }}
                                            />
                                        </View>

                                        <View style={{ width: 50, height: 60 }}>
                                            <Button
                                                icon={{
                                                    name: 'plus',
                                                    type: 'font-awesome',
                                                    size: 25,
                                                    color: !addPeer
                                                        ? themeColor(
                                                              'secondaryText'
                                                          )
                                                        : themeColor('text')
                                                }}
                                                iconOnly
                                                onPress={() => {
                                                    if (!addPeer) return;
                                                    const newNeutrinoPeers = [
                                                        ...neutrinoPeers,
                                                        addPeer
                                                    ];
                                                    this.setState({
                                                        neutrinoPeers:
                                                            newNeutrinoPeers,
                                                        addPeer: ''
                                                    });
                                                    if (
                                                        embeddedLndNetwork ===
                                                        'Mainnet'
                                                    ) {
                                                        updateSettings({
                                                            neutrinoPeersMainnet:
                                                                newNeutrinoPeers
                                                        });
                                                    } else if (
                                                        embeddedLndNetwork ===
                                                        'Testnet'
                                                    ) {
                                                        updateSettings({
                                                            neutrinoPeersTestnet:
                                                                newNeutrinoPeers
                                                        });
                                                    }
                                                }}
                                            />
                                        </View>
                                    </Row>
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

                                                <Row>
                                                    <View
                                                        style={{
                                                            alignSelf:
                                                                'flex-end',
                                                            width: 50,
                                                            height: 60
                                                        }}
                                                    >
                                                        <Button
                                                            icon={{
                                                                name: 'hourglass',
                                                                type: 'font-awesome',
                                                                size: 25,
                                                                color: themeColor(
                                                                    'text'
                                                                )
                                                            }}
                                                            iconOnly
                                                            onPress={async () => {
                                                                try {
                                                                    this.setState(
                                                                        {
                                                                            pingTime: 0,
                                                                            pingTimeout:
                                                                                false,
                                                                            pingHost:
                                                                                item,
                                                                            pinging:
                                                                                true
                                                                        }
                                                                    );

                                                                    const ms =
                                                                        await Ping.start(
                                                                            item,
                                                                            {
                                                                                timeout: 1000
                                                                            }
                                                                        );
                                                                    this.setState(
                                                                        {
                                                                            pingTime:
                                                                                ms,
                                                                            pinging:
                                                                                false
                                                                        }
                                                                    );
                                                                } catch (e) {
                                                                    this.setState(
                                                                        {
                                                                            pingTimeout:
                                                                                true,
                                                                            pinging:
                                                                                false
                                                                        }
                                                                    );
                                                                }
                                                            }}
                                                        />
                                                    </View>
                                                    <View
                                                        style={{
                                                            alignSelf:
                                                                'flex-end',
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
                                                                if (
                                                                    embeddedLndNetwork ===
                                                                    'Mainnet'
                                                                ) {
                                                                    updateSettings(
                                                                        {
                                                                            neutrinoPeersMainnet:
                                                                                newNeutrinoPeers
                                                                        }
                                                                    );
                                                                } else if (
                                                                    embeddedLndNetwork ===
                                                                    'Testnet'
                                                                ) {
                                                                    updateSettings(
                                                                        {
                                                                            neutrinoPeersTestnet:
                                                                                newNeutrinoPeers
                                                                        }
                                                                    );
                                                                }
                                                            }}
                                                        />
                                                    </View>
                                                </Row>
                                            </Row>
                                        )}
                                        keyExtractor={(
                                            item: any,
                                            index: number
                                        ) => `${item.txid}-${index}`}
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
                    {(dontAllowOtherPeers ||
                        mainnetPeersChanged ||
                        testnetPeersChanged) && (
                        <View style={{ marginBottom: 10, marginTop: 10 }}>
                            <Button
                                title={localeString('general.reset')}
                                onPress={() => {
                                    if (embeddedLndNetwork === 'Mainnet') {
                                        this.setState({
                                            neutrinoPeers:
                                                DEFAULT_NEUTRINO_PEERS_MAINNET,
                                            dontAllowOtherPeers: false
                                        });
                                        updateSettings({
                                            neutrinoPeersMainnet:
                                                DEFAULT_NEUTRINO_PEERS_MAINNET,
                                            dontAllowOtherPeers: false
                                        });
                                    }

                                    if (embeddedLndNetwork === 'Testnet') {
                                        this.setState({
                                            neutrinoPeers:
                                                DEFAULT_NEUTRINO_PEERS_TESTNET,
                                            dontAllowOtherPeers: false
                                        });
                                        updateSettings({
                                            neutrinoPeersTestnet:
                                                DEFAULT_NEUTRINO_PEERS_TESTNET,
                                            dontAllowOtherPeers: false
                                        });
                                    }
                                }}
                            />
                        </View>
                    )}
                </View>
            </Screen>
        );
    }
}
