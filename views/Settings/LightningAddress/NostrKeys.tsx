import * as React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { generatePrivateKey, getPublicKey, nip19 } from 'nostr-tools';

import Button from '../../../components/Button';
import KeyValue from '../../../components/KeyValue';
import Screen from '../../../components/Screen';
import Text from '../../../components/Text';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import TextInput from '../../../components/TextInput';
import {
    ErrorMessage,
    WarningMessage
} from '../../../components/SuccessErrorMessage';
import { Row } from '../../../components/layout/Row';

import SettingsStore from '../../../stores/SettingsStore';
import LightningAddressStore from '../../../stores/LightningAddressStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import DiceSVG from '../../../assets/images/SVG/Dice.svg';
import HiddenSVG from '../../../assets/images/SVG/Hidden.svg';
import VisibleSVG from '../../../assets/images/SVG/Visible.svg';

interface NostrKeyProps {
    navigation: any;
    SettingsStore: SettingsStore;
    LightningAddressStore: LightningAddressStore;
}

interface NostrKeyState {
    existingNostrPrivateKey: string;
    nostrPrivateKey: string;
    nostrPublicKey: string;
    nostrNsec: string;
    nostrNpub: string;
    setup: boolean;
    editMode: boolean;
    revealSensitive: boolean;
}

@inject('SettingsStore', 'LightningAddressStore')
@observer
export default class NostrKey extends React.Component<
    NostrKeyProps,
    NostrKeyState
> {
    state = {
        existingNostrPrivateKey: '',
        nostrPrivateKey: '',
        nostrPublicKey: '',
        nostrNpub: '',
        nostrNsec: '',
        setup: false,
        editMode: false,
        revealSensitive: false
    };

    generateNostrKeys = () => {
        const nostrPrivateKey = generatePrivateKey();
        const nostrPublicKey = getPublicKey(nostrPrivateKey);
        const nostrNsec = nip19.nsecEncode(nostrPrivateKey);
        const nostrNpub = nip19.npubEncode(nostrPublicKey);

        this.setState({
            nostrPrivateKey,
            nostrPublicKey,
            nostrNsec,
            nostrNpub
        });
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore, navigation } = this.props;
        const { settings } = SettingsStore;

        const setup = navigation.getParam('setup', false);
        const nostrPrivateKey = navigation.getParam(
            'nostrPrivateKey',
            settings?.lightningAddress?.nostrPrivateKey || ''
        );

        let nostrPublicKey, nostrNsec, nostrNpub;
        if (nostrPrivateKey) {
            nostrPublicKey = getPublicKey(nostrPrivateKey);
            nostrNsec = nip19.nsecEncode(nostrPrivateKey);
            nostrNpub = nip19.npubEncode(nostrPublicKey);
        }

        this.setState({
            existingNostrPrivateKey: nostrPrivateKey,
            nostrPrivateKey,
            nostrPublicKey,
            nostrNsec,
            nostrNpub,
            setup,
            editMode: setup,
            revealSensitive: false
        });
    }

    render() {
        const { navigation, LightningAddressStore, SettingsStore } = this.props;
        const {
            existingNostrPrivateKey,
            nostrPrivateKey,
            nostrPublicKey,
            nostrNsec,
            nostrNpub,
            setup,
            editMode,
            revealSensitive
        } = this.state;
        const { update, error_msg, loading } = LightningAddressStore;
        const { updateSettings, settings } = SettingsStore;
        const { lightningAddress } = settings;
        const {
            enabled,
            automaticallyAccept,
            automaticallyRequestOlympusChannels,
            allowComments,
            nostrRelays,
            notifications
        } = lightningAddress;

        const VisibilityButton = () => (
            <View style={{ right: 15 }}>
                <TouchableOpacity
                    onPress={() => {
                        this.setState({
                            revealSensitive: !revealSensitive
                        });
                    }}
                >
                    {revealSensitive ? (
                        <HiddenSVG
                            fill={themeColor('text')}
                            width={35}
                            height={35}
                        />
                    ) : (
                        <VisibleSVG
                            fill={themeColor('text')}
                            width={35}
                            height={35}
                        />
                    )}
                </TouchableOpacity>
            </View>
        );

        const EditButton = () => (
            <View style={{ right: 30 }}>
                <Icon
                    name="edit"
                    onPress={() => {
                        this.setState({
                            editMode: true
                        });
                    }}
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={30}
                />
            </View>
        );

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: editMode
                                ? localeString(
                                      'views.Settings.LightningAddress.changeNostrKeys'
                                  )
                                : localeString('nostr.keys'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        rightComponent={
                            <Row>
                                {!editMode && <EditButton />}
                                <VisibilityButton />
                            </Row>
                        }
                        navigation={navigation}
                    />
                    <View style={{ flex: 1, margin: 5 }}>
                        {loading && <LoadingIndicator />}
                        <View style={styles.wrapper}>
                            {!loading && !!error_msg && (
                                <ErrorMessage message={error_msg} dismissable />
                            )}

                            {!setup && editMode && (
                                <WarningMessage
                                    message={localeString(
                                        'views.Settings.LightningAddress.nostrKeys.changeWarning'
                                    )}
                                    dismissable
                                />
                            )}

                            {editMode && (
                                <>
                                    <Text style={styles.text}>
                                        {`${localeString(
                                            'nostr.privkey'
                                        )} ${localeString(
                                            'general.or'
                                        )} ${localeString('nostr.nsec')}`}
                                    </Text>
                                    <View
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'row'
                                        }}
                                    >
                                        <TextInput
                                            value={nostrPrivateKey}
                                            onChangeText={(text: string) => {
                                                let nostrPrivateKey: string =
                                                        text,
                                                    nostrPublicKey,
                                                    nostrNpub;
                                                try {
                                                    if (text.includes('nsec')) {
                                                        let { type, data } =
                                                            nip19.decode(text);
                                                        if (
                                                            type === 'nsec' &&
                                                            typeof data ===
                                                                'string'
                                                        ) {
                                                            nostrPrivateKey =
                                                                data;
                                                        }
                                                    }
                                                    nostrPublicKey =
                                                        getPublicKey(
                                                            nostrPrivateKey
                                                        );
                                                    nostrNpub =
                                                        nip19.npubEncode(
                                                            nostrPublicKey
                                                        );
                                                } catch (e) {}
                                                this.setState({
                                                    nostrPrivateKey,
                                                    nostrPublicKey,
                                                    nostrNpub
                                                });
                                            }}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            style={{
                                                flex: 1,
                                                flexDirection: 'row'
                                            }}
                                            secureTextEntry={!revealSensitive}
                                        />
                                        <TouchableOpacity
                                            onPress={() =>
                                                this.generateNostrKeys()
                                            }
                                            style={{
                                                marginTop: 22,
                                                marginLeft: 15
                                            }}
                                        >
                                            <DiceSVG
                                                fill={themeColor('text')}
                                                width="35"
                                                height="35"
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}

                            {!editMode && nostrPrivateKey && (
                                <KeyValue
                                    keyValue={localeString('nostr.privkey')}
                                    value={
                                        revealSensitive
                                            ? nostrPrivateKey
                                            : '*'.repeat(64)
                                    }
                                    sensitive
                                />
                            )}

                            {nostrPublicKey && (
                                <KeyValue
                                    keyValue={localeString('nostr.pubkey')}
                                    value={nostrPublicKey}
                                    sensitive
                                />
                            )}

                            {!editMode && nostrNsec && (
                                <KeyValue
                                    keyValue={localeString('nostr.nsec')}
                                    value={
                                        revealSensitive
                                            ? nostrNsec
                                            : '*'.repeat(63)
                                    }
                                    sensitive
                                />
                            )}

                            {nostrNpub && (
                                <KeyValue
                                    keyValue={localeString('nostr.npub')}
                                    value={nostrNpub}
                                    sensitive
                                />
                            )}
                        </View>
                        {editMode && (
                            <View>
                                <View style={{ bottom: 15, margin: 10 }}>
                                    <Button
                                        title={localeString(
                                            'views.Settings.SetPassword.save'
                                        )}
                                        onPress={() => {
                                            if (setup) {
                                                navigation.navigate(
                                                    'LightningAddress',
                                                    { nostrPrivateKey }
                                                );
                                            } else {
                                                try {
                                                    update({
                                                        nostr_pk: nostrPublicKey
                                                    }).then(async () => {
                                                        this.setState({
                                                            existingNostrPrivateKey:
                                                                nostrPrivateKey,
                                                            editMode: false
                                                        });
                                                        await updateSettings({
                                                            lightningAddress: {
                                                                enabled,
                                                                automaticallyAccept,
                                                                automaticallyRequestOlympusChannels,
                                                                allowComments,
                                                                nostrPrivateKey,
                                                                nostrRelays,
                                                                notifications
                                                            }
                                                        });
                                                    });
                                                } catch (e) {}
                                            }
                                        }}
                                        disabled={
                                            existingNostrPrivateKey ===
                                                nostrPrivateKey || !nostrNpub
                                        }
                                    />
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book',
        color: themeColor('text')
    },
    wrapper: {
        flex: 1,
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 15,
        paddingRight: 15
    }
});
