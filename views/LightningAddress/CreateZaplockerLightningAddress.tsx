import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
// @ts-ignore:next-line
import { generatePrivateKey, getPublicKey, nip19 } from 'nostr-tools';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { schnorr } from '@noble/curves/secp256k1';
import { bytesToHex } from '@noble/hashes/utils';
import hashjs from 'hash.js';

import Button from '../../components/Button';
import KeyValue from '../../components/KeyValue';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import TextInput from '../../components/TextInput';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { Row } from '../../components/layout/Row';

import LightningAddressStore from '../../stores/LightningAddressStore';
import SettingsStore, {
    DEFAULT_NOSTR_RELAYS
} from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import ZeusPayIcon from '../../assets/images/SVG/zeus-pay.svg';

interface CreateZaplockerLightningAddressProps {
    navigation: StackNavigationProp<any, any>;
    LightningAddressStore: LightningAddressStore;
    SettingsStore: SettingsStore;
    route: Route<
        'CreateZaplockerLightningAddress',
        { relays: string[]; nostrPrivateKey: string; switchTo: boolean }
    >;
}

interface CreateZaplockerLightningAddressState {
    newLightningAddress: string;
    nostrPrivateKey: string;
    nostrPublicKey: string;
    nostrNpub: string;
    nostrRelays: Array<string>;
    loading: boolean;
}

@inject('LightningAddressStore', 'SettingsStore')
@observer
export default class CreateZaplockerLightningAddress extends React.Component<
    CreateZaplockerLightningAddressProps,
    CreateZaplockerLightningAddressState
> {
    isInitialFocus = true;

    state = {
        newLightningAddress: '',
        nostrPrivateKey: '',
        nostrPublicKey: '',
        nostrNpub: '',
        nostrRelays: DEFAULT_NOSTR_RELAYS,
        loading: false
    };

    generateNostrKeys = () => {
        const nostrPrivateKey = generatePrivateKey();
        const nostrPublicKey = getPublicKey(nostrPrivateKey);
        const nostrNpub = nip19.npubEncode(nostrPublicKey);

        this.setState({
            nostrPrivateKey,
            nostrPublicKey,
            nostrNpub
        });
    };

    async componentDidMount() {
        this.generateNostrKeys();

        this.setState({
            newLightningAddress: ''
        });
    }

    UNSAFE_componentWillReceiveProps = (
        newProps: CreateZaplockerLightningAddressProps
    ) => {
        const { route } = newProps;
        const nostrRelays = route.params?.relays;
        if (nostrRelays) {
            this.setState({ nostrRelays });
        }

        const nostrPrivateKey = route.params?.nostrPrivateKey ?? '';
        if (nostrPrivateKey) {
            const nostrPublicKey = getPublicKey(nostrPrivateKey);
            const nostrNpub = nip19.npubEncode(nostrPublicKey);

            this.setState({
                nostrPrivateKey,
                nostrPublicKey,
                nostrNpub
            });
        }
    };

    render() {
        const { navigation, LightningAddressStore, SettingsStore, route } =
            this.props;
        const {
            newLightningAddress,
            nostrPrivateKey,
            nostrPublicKey,
            nostrNpub,
            nostrRelays
        } = this.state;
        const { createZaplocker, update, fees, error_msg } =
            LightningAddressStore;
        const { updateSettings, settings }: any = SettingsStore;
        const switchTo = route.params?.switchTo;

        const loading = this.state.loading || LightningAddressStore.loading;

        const InfoButton = () => (
            <View>
                <Icon
                    name="info"
                    onPress={() => {
                        navigation.navigate('ZaplockerInfo');
                    }}
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={35}
                />
            </View>
        );

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={
                            <ZeusPayIcon
                                fill={themeColor('text')}
                                width={30}
                                height={30}
                            />
                        }
                        rightComponent={
                            !loading ? (
                                <Row>{fees && <InfoButton />}</Row>
                            ) : undefined
                        }
                        navigation={navigation}
                    />
                    <View style={{ flex: 1, margin: 5 }}>
                        {loading && <LoadingIndicator />}
                        {!loading && !!error_msg && (
                            <ErrorMessage message={error_msg} dismissable />
                        )}
                        {!loading && (
                            <>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.wrapper}>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.LightningAddress.chooseHandle'
                                            )}
                                        </Text>
                                        <View
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'row'
                                            }}
                                        >
                                            <TextInput
                                                value={newLightningAddress}
                                                onChangeText={(
                                                    text: string
                                                ) => {
                                                    this.setState({
                                                        newLightningAddress:
                                                            text
                                                    });
                                                }}
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                style={{
                                                    flex: 1,
                                                    flexDirection: 'row'
                                                }}
                                            />
                                            <Row>
                                                <Text
                                                    style={{
                                                        ...styles.text,
                                                        color: themeColor(
                                                            'text'
                                                        ),
                                                        fontSize: 20,
                                                        marginLeft: 5
                                                    }}
                                                >
                                                    @zeuspay.com
                                                </Text>
                                            </Row>
                                        </View>
                                    </View>

                                    <>
                                        <View style={styles.wrapper}>
                                            <Text
                                                style={{
                                                    fontFamily:
                                                        'PPNeueMontreal-Book',
                                                    color: themeColor('text'),
                                                    marginTop: 15,
                                                    marginBottom: 10
                                                }}
                                            >
                                                {localeString(
                                                    'views.Settings.LightningAddress.zaplockerVerification'
                                                )}
                                            </Text>

                                            {nostrNpub && (
                                                <KeyValue
                                                    keyValue={localeString(
                                                        'nostr.npub'
                                                    )}
                                                    value={nostrNpub}
                                                />
                                            )}
                                        </View>
                                        <ListItem
                                            containerStyle={{
                                                backgroundColor: 'transparent'
                                            }}
                                            onPress={() =>
                                                navigation.navigate(
                                                    'NostrKeys',
                                                    {
                                                        setup: true,
                                                        nostrPrivateKey
                                                    }
                                                )
                                            }
                                        >
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
                                                    {localeString(
                                                        'views.Settings.LightningAddress.changeNostrKeys'
                                                    )}
                                                </ListItem.Title>
                                            </ListItem.Content>
                                            <Icon
                                                name="keyboard-arrow-right"
                                                color={themeColor(
                                                    'secondaryText'
                                                )}
                                            />
                                        </ListItem>
                                        <ListItem
                                            containerStyle={{
                                                backgroundColor: 'transparent'
                                            }}
                                            onPress={() =>
                                                navigation.navigate(
                                                    'NostrRelays',
                                                    {
                                                        setup: true,
                                                        relays: nostrRelays
                                                    }
                                                )
                                            }
                                        >
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
                                                    {`${localeString(
                                                        'views.Settings.Nostr.relays'
                                                    )} (${
                                                        nostrRelays?.length || 0
                                                    })`}
                                                </ListItem.Title>
                                            </ListItem.Content>
                                            <Icon
                                                name="keyboard-arrow-right"
                                                color={themeColor(
                                                    'secondaryText'
                                                )}
                                            />
                                        </ListItem>
                                    </>
                                </View>
                                <View style={{ bottom: 15, margin: 10 }}>
                                    <Button
                                        title={
                                            switchTo
                                                ? localeString(
                                                      'views.Settings.LightningAddress.switchToZaplocker'
                                                  )
                                                : localeString(
                                                      'views.Settings.LightningAddress.create'
                                                  )
                                        }
                                        onPress={async () => {
                                            if (switchTo) {
                                                this.setState({
                                                    loading: true
                                                });

                                                const relays_sig = bytesToHex(
                                                    schnorr.sign(
                                                        hashjs
                                                            .sha256()
                                                            .update(
                                                                JSON.stringify(
                                                                    nostrRelays
                                                                )
                                                            )
                                                            .digest('hex'),
                                                        nostrPrivateKey
                                                    )
                                                );

                                                await update({
                                                    nostr_pk: nostrPublicKey,
                                                    relays: nostrRelays,
                                                    relays_sig,
                                                    address_type: 'zaplocker',
                                                    domain: 'zeuspay.com'
                                                }).then(async (response) => {
                                                    if (response.success) {
                                                        await updateSettings({
                                                            lightningAddress: {
                                                                ...settings.lightningAddress,
                                                                nostrPrivateKey,
                                                                nostrRelays
                                                            }
                                                        });
                                                        navigation.popTo(
                                                            'LightningAddress'
                                                        );
                                                    } else {
                                                        this.setState({
                                                            loading: false
                                                        });
                                                    }
                                                });
                                            } else {
                                                createZaplocker(
                                                    newLightningAddress,
                                                    nostrPublicKey,
                                                    nostrPrivateKey,
                                                    nostrRelays
                                                ).then((response) => {
                                                    if (response.success) {
                                                        navigation.popTo(
                                                            'LightningAddress'
                                                        );
                                                    }
                                                });
                                            }
                                        }}
                                        disabled={
                                            !nostrPublicKey ||
                                            !nostrNpub ||
                                            !nostrRelays ||
                                            nostrRelays.length === 0
                                        }
                                    />
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    explainer: {
        fontSize: 18,
        marginBottom: 10,
        fontFamily: 'PPNeueMontreal-Book'
    },
    wrapper: {
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 15,
        paddingRight: 15
    },
    optionBlock: {
        marginTop: 10,
        marginBottom: 12
    },
    prosConsToggle: {
        marginBottom: 8
    },
    prosCons: {
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 40
    },
    prosConsColumn: {
        alignItems: 'flex-start',
        flexDirection: 'column',
        width: '47%',
        height: '100%'
    }
});
