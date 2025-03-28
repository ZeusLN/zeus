import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
// @ts-ignore:next-line
import { generatePrivateKey, getPublicKey, nip19 } from 'nostr-tools';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

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
import { DEFAULT_NOSTR_RELAYS } from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import ZeusPayIcon from '../../assets/images/SVG/zeus-pay.svg';

interface CreateZaplockerLightningAddressProps {
    navigation: StackNavigationProp<any, any>;
    LightningAddressStore: LightningAddressStore;
    route: Route<
        'CreateZaplockerLightningAddress',
        { relays: string[]; nostrPrivateKey: string }
    >;
}

interface CreateZaplockerLightningAddressState {
    newLightningAddress: string;
    nostrPrivateKey: string;
    nostrPublicKey: string;
    nostrNpub: string;
    nostrRelays: Array<string>;
}

@inject('LightningAddressStore')
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
        nostrRelays: DEFAULT_NOSTR_RELAYS
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
        const { navigation, LightningAddressStore } = this.props;
        const {
            newLightningAddress,
            nostrPrivateKey,
            nostrPublicKey,
            nostrNpub,
            nostrRelays
        } = this.state;
        const { createZaplocker, fees, error_msg, loading } =
            LightningAddressStore;

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
                                        title={localeString(
                                            'views.Settings.LightningAddress.create'
                                        )}
                                        onPress={() =>
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
                                            })
                                        }
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
