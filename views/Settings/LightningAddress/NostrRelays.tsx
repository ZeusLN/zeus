import * as React from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { schnorr } from '@noble/curves/secp256k1';
import { bytesToHex } from '@noble/hashes/utils';
import hashjs from 'hash.js';

import { Row } from '../../../components/layout/Row';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import Button from '../../../components/Button';
import KeyValue from '../../../components/KeyValue';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Screen from '../../../components/Screen';
import Text from '../../../components/Text';
import TextInput from '../../../components/TextInput';

import SettingsStore from '../../../stores/SettingsStore';
import LightningAddressStore from '../../../stores/LightningAddressStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

interface NostrRelaysProps {
    navigation: any;
    SettingsStore: SettingsStore;
    LightningAddressStore: LightningAddressStore;
}

interface NostrRelaysState {
    setup: boolean;
    relays: Array<string>;
    addRelay: string;
}

@inject('SettingsStore', 'LightningAddressStore')
@observer
export default class NostrRelays extends React.Component<
    NostrRelaysProps,
    NostrRelaysState
> {
    state = {
        setup: false,
        relays: [],
        addRelay: ''
    };

    remove = (arrOriginal, elementToRemove) => {
        return arrOriginal.filter(function (el) {
            return el !== elementToRemove;
        });
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore, navigation } = this.props;
        const { settings, getSettings } = SettingsStore;

        const setup = navigation.getParam('setup', false);
        const relays = navigation.getParam('relays', null);

        await getSettings();

        this.setState({
            setup,
            relays: relays
                ? relays
                : settings.lightningAddress.nostrRelays || []
        });
    }

    render() {
        const { navigation, SettingsStore, LightningAddressStore } = this.props;
        const { relays, addRelay, setup } = this.state;
        const { updateSettings, settings }: any = SettingsStore;
        const { lightningAddress } = settings;
        const {
            enabled,
            automaticallyAccept,
            automaticallyRequestOlympusChannels,
            allowComments,
            nostrPrivateKey,
            notifications
        } = lightningAddress;
        const { update, loading, error_msg } = LightningAddressStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent={
                            setup ? (
                                <Icon
                                    name="arrow-back"
                                    onPress={() => {
                                        navigation.navigate(
                                            'LightningAddress',
                                            { relays }
                                        );
                                    }}
                                    color={themeColor('text')}
                                    underlayColor="transparent"
                                    size={35}
                                />
                            ) : (
                                'Back'
                            )
                        }
                        centerComponent={{
                            text: localeString('views.Settings.Nostr.relays'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        rightComponent={
                            loading && <LoadingIndicator size={35} />
                        }
                        navigation={navigation}
                    />
                    <ScrollView style={{ margin: 5 }}>
                        <View style={{ margin: 5 }}>
                            {error_msg && (
                                <ErrorMessage message={error_msg} dismissable />
                            )}
                            <Text>
                                {localeString(
                                    'views.Settings.EmbeddedNode.Peers.addRelay'
                                )}
                            </Text>
                            <KeyValue
                                keyValue={localeString(
                                    'views.Settings.Nostr.addRelay'
                                )}
                            />
                            <Row align="flex-end">
                                <TextInput
                                    placeholder="wss://relay.damus.io"
                                    onChangeText={(text: string) =>
                                        this.setState({ addRelay: text })
                                    }
                                    value={addRelay}
                                    style={{
                                        flex: 1,
                                        borderWidth:
                                            !addRelay ||
                                            addRelay.startsWith('wss://')
                                                ? 0
                                                : 3,
                                        borderColor: themeColor('warning')
                                    }}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                <View style={{ width: 50, height: 60 }}>
                                    <Button
                                        icon={{
                                            name: 'plus',
                                            type: 'font-awesome',
                                            size: 25
                                        }}
                                        iconOnly
                                        onPress={async () => {
                                            if (
                                                !addRelay ||
                                                !addRelay.startsWith('wss://')
                                            )
                                                return;
                                            const newNostrRelays = [
                                                ...relays,
                                                addRelay
                                            ];
                                            if (setup) {
                                                this.setState({
                                                    relays: newNostrRelays,
                                                    addRelay: ''
                                                });
                                            } else {
                                                const relays_sig = bytesToHex(
                                                    schnorr.sign(
                                                        hashjs
                                                            .sha256()
                                                            .update(
                                                                JSON.stringify(
                                                                    newNostrRelays
                                                                )
                                                            )
                                                            .digest('hex'),
                                                        nostrPrivateKey
                                                    )
                                                );
                                                try {
                                                    await update({
                                                        relays: newNostrRelays,
                                                        relays_sig
                                                    }).then(async () => {
                                                        this.setState({
                                                            relays: newNostrRelays,
                                                            addRelay: ''
                                                        });
                                                        await updateSettings({
                                                            lightningAddress: {
                                                                enabled,
                                                                automaticallyAccept,
                                                                automaticallyRequestOlympusChannels,
                                                                allowComments,
                                                                nostrPrivateKey,
                                                                nostrRelays:
                                                                    newNostrRelays,
                                                                notifications
                                                            }
                                                        });
                                                    });
                                                } catch (e) {}
                                            }
                                        }}
                                    />
                                </View>
                            </Row>
                            <Text>
                                {localeString('views.Settings.Nostr.relays')}
                            </Text>
                            {relays && relays.length > 0 ? (
                                <FlatList
                                    data={relays}
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
                                                        size: 25
                                                    }}
                                                    iconOnly
                                                    onPress={async () => {
                                                        const newNostrRelays =
                                                            this.remove(
                                                                relays,
                                                                item
                                                            );

                                                        if (setup) {
                                                            this.setState({
                                                                relays: newNostrRelays
                                                            });
                                                        } else {
                                                            const relays_sig =
                                                                bytesToHex(
                                                                    schnorr.sign(
                                                                        hashjs
                                                                            .sha256()
                                                                            .update(
                                                                                JSON.stringify(
                                                                                    newNostrRelays
                                                                                )
                                                                            )
                                                                            .digest(
                                                                                'hex'
                                                                            ),
                                                                        nostrPrivateKey
                                                                    )
                                                                );
                                                            try {
                                                                await update({
                                                                    relays: newNostrRelays,
                                                                    relays_sig
                                                                }).then(
                                                                    async () => {
                                                                        this.setState(
                                                                            {
                                                                                relays: newNostrRelays
                                                                            }
                                                                        );
                                                                        await updateSettings(
                                                                            {
                                                                                lightningAddress:
                                                                                    {
                                                                                        enabled,
                                                                                        automaticallyAccept,
                                                                                        automaticallyRequestOlympusChannels,
                                                                                        allowComments,
                                                                                        nostrPrivateKey,
                                                                                        nostrRelays:
                                                                                            newNostrRelays,
                                                                                        notifications
                                                                                    }
                                                                            }
                                                                        );
                                                                    }
                                                                );
                                                            } catch (e) {}
                                                        }
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
                                )}.`}</Text>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
