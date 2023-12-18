import * as React from 'react';
import {
    Dimensions,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { generatePrivateKey, getPublicKey, nip19 } from 'nostr-tools';

import LightningAddressPayment from './LightningAddressPayment';

import Button from '../../../components/Button';
import KeyValue from '../../../components/KeyValue';
import Screen from '../../../components/Screen';
import Text from '../../../components/Text';
import Header from '../../../components/Header';
import LightningLoadingPattern from '../../../components/LightningLoadingPattern';
import LoadingIndicator from '../../../components/LoadingIndicator';
import TextInput from '../../../components/TextInput';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import { Row } from '../../../components/layout/Row';
import { Spacer } from '../../../components/layout/Spacer';

import ChannelsStore from '../../../stores/ChannelsStore';
import LightningAddressStore from '../../../stores/LightningAddressStore';
import SettingsStore, {
    DEFAULT_NOSTR_RELAYS
} from '../../../stores/SettingsStore';
import UnitsStore from '../../../stores/UnitsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import UrlUtils from '../../../utils/UrlUtils';

import QR from '../../../assets/images/SVG/QR.svg';
import Gear from '../../../assets/images/SVG/Gear.svg';

interface LightningAddressProps {
    navigation: any;
    ChannelsStore: ChannelsStore;
    LightningAddressStore: LightningAddressStore;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
}

interface LightningAddressState {
    newLightningAddress: string;
    nostrPrivateKey: string;
    nostrPublicKey: string;
    nostrNpub: string;
    nostrRelays: Array<string>;
}

@inject('LightningAddressStore', 'ChannelsStore', 'SettingsStore', 'UnitsStore')
@observer
export default class LightningAddress extends React.Component<
    LightningAddressProps,
    LightningAddressState
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
        const { LightningAddressStore, navigation } = this.props;
        const { status } = LightningAddressStore;

        const skipStatus: boolean = navigation.getParam('skipStatus', false);

        this.generateNostrKeys();

        this.setState({
            newLightningAddress: ''
        });

        if (!skipStatus) status();

        // triggers when loaded from navigation or back action
        navigation.addListener('didFocus', this.handleFocus);
    }

    handleFocus = () => {
        if (this.isInitialFocus) {
            this.isInitialFocus = false;
        } else {
            this.props.LightningAddressStore.status();
        }
    };

    UNSAFE_componentWillReceiveProps = (newProps: any) => {
        const { navigation } = newProps;
        const nostrRelays = navigation.getParam('relays', null);
        if (nostrRelays) {
            this.setState({
                nostrRelays
            });
        }

        const nostrPrivateKey = navigation.getParam('nostrPrivateKey', '');
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
        const {
            navigation,
            LightningAddressStore,
            ChannelsStore,
            SettingsStore,
            UnitsStore
        } = this.props;
        const {
            newLightningAddress,
            nostrPrivateKey,
            nostrPublicKey,
            nostrNpub,
            nostrRelays
        } = this.state;
        const {
            create,
            status,
            redeemAllOpenPayments,
            lightningAddressHandle,
            lightningAddressDomain,
            availableHashes,
            paid,
            fees,
            error,
            error_msg,
            loading,
            redeeming,
            readyToAutomaticallyAccept,
            prepareToAutomaticallyAcceptStart
        } = LightningAddressStore;

        const { fontScale } = Dimensions.get('window');

        const automaticallyAccept =
            SettingsStore.settings?.lightningAddress?.automaticallyAccept;
        const isReady =
            SettingsStore.implementation !== 'embedded-lnd' ||
            !prepareToAutomaticallyAcceptStart ||
            !automaticallyAccept ||
            readyToAutomaticallyAccept;

        const hasChannels =
            ChannelsStore.channels && ChannelsStore.channels.length > 0;

        const InfoButton = () => (
            <View style={{ right: 15 }}>
                <Icon
                    name="info"
                    onPress={() => {
                        navigation.navigate('LightningAddressInfo');
                    }}
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={35}
                />
            </View>
        );

        const SettingsButton = () => (
            <TouchableOpacity
                onPress={() => {
                    navigation.navigate('LightningAddressSettings');
                }}
            >
                <Gear
                    style={{ alignSelf: 'center' }}
                    fill={themeColor('text')}
                />
            </TouchableOpacity>
        );

        const QRButton = () => {
            const address = `${lightningAddressHandle}@${lightningAddressDomain}`;
            return (
                <TouchableOpacity
                    onPress={() =>
                        navigation.navigate('QR', {
                            value: `lightning:${address}`,
                            label: address,
                            hideText: true,
                            jumboLabel: true,
                            logo: require('../../../assets/images/pay-z-black.png')
                        })
                    }
                    style={{ marginTop: 10 }}
                >
                    <QR
                        fill={themeColor('text')}
                        style={{ alignSelf: 'center' }}
                    />
                </TouchableOpacity>
            );
        };

        const statusGood = availableHashes > 50;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('general.lightningAddress'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        rightComponent={
                            !loading && !redeeming ? (
                                <Row>
                                    {fees && !error && <InfoButton />}
                                    {lightningAddressHandle && !error && (
                                        <SettingsButton />
                                    )}
                                </Row>
                            ) : undefined
                        }
                        navigation={navigation}
                    />
                    {redeeming && <LightningLoadingPattern />}
                    <View style={{ flex: 1, margin: 5 }}>
                        {loading && <LoadingIndicator />}
                        {!loading && !redeeming && !!error_msg && (
                            <ErrorMessage message={error_msg} dismissable />
                        )}
                        {!loading && !redeeming && lightningAddressHandle && (
                            <View
                                style={{
                                    alignSelf: 'center',
                                    marginTop: 30,
                                    marginBottom: 30
                                }}
                            >
                                <Row
                                    style={{
                                        alignSelf: 'center'
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 26 / fontScale,
                                            color: themeColor('text'),
                                            textAlign: 'center'
                                        }}
                                    >
                                        {`${lightningAddressHandle}@${lightningAddressDomain}`}
                                    </Text>
                                </Row>
                                <Row
                                    style={{
                                        alignSelf: 'center',
                                        marginTop: 4
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontFamily: 'PPNeueMontreal-Book',

                                            color: themeColor('text'),
                                            textAlign: 'center'
                                        }}
                                    >
                                        {`${localeString(
                                            'views.Transaction.status'
                                        )}: `}
                                    </Text>
                                    <Text
                                        style={{
                                            fontFamily: 'PPNeueMontreal-Book',
                                            color: statusGood
                                                ? themeColor('success')
                                                : themeColor('error'),
                                            textAlign: 'center'
                                        }}
                                    >
                                        {statusGood
                                            ? localeString('general.good')
                                            : localeString('general.bad')}
                                    </Text>
                                    <Text
                                        style={{
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 11,
                                            color: themeColor('secondaryText'),
                                            left: 5
                                        }}
                                        infoText={[
                                            localeString(
                                                'views.Settings.LightningAddress.statusExplainer1'
                                            ),
                                            localeString(
                                                'views.Settings.LightningAddress.statusExplainer2'
                                            )
                                        ]}
                                    >
                                        {` (${availableHashes})`}
                                    </Text>
                                </Row>
                                <QRButton />
                            </View>
                        )}
                        {!loading &&
                            !redeeming &&
                            !lightningAddressHandle &&
                            hasChannels && (
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
                                            </View>
                                        </View>

                                        <>
                                            <View style={styles.wrapper}>
                                                <Text
                                                    style={{
                                                        fontFamily:
                                                            'PPNeueMontreal-Book',
                                                        color: themeColor(
                                                            'text'
                                                        ),
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
                                                    backgroundColor:
                                                        'transparent'
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
                                                    backgroundColor:
                                                        'transparent'
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
                                                            nostrRelays?.length ||
                                                            0
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
                                    <View>
                                        <View
                                            style={{ bottom: 15, margin: 10 }}
                                        >
                                            <Button
                                                title={localeString(
                                                    'views.Settings.LightningAddress.create'
                                                )}
                                                onPress={() =>
                                                    create(
                                                        newLightningAddress,
                                                        nostrPublicKey,
                                                        nostrPrivateKey,
                                                        nostrRelays
                                                    ).then(() => status())
                                                }
                                                disabled={
                                                    !nostrPublicKey ||
                                                    !nostrNpub ||
                                                    !nostrRelays ||
                                                    nostrRelays.length === 0
                                                }
                                            />
                                        </View>
                                    </View>
                                </>
                            )}
                        {!loading &&
                            !redeeming &&
                            !lightningAddressHandle &&
                            !hasChannels && (
                                <>
                                    <View
                                        style={{
                                            flex: 1,
                                            marginLeft: 5,
                                            marginRight: 5
                                        }}
                                    >
                                        <Text
                                            style={{
                                                ...styles.explainer,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.LightningAddress.explainer1'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                ...styles.explainer,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.LightningAddress.explainer2'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                ...styles.explainer,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Wallet.KeypadPane.lspExplainerFirstChannel'
                                            )}
                                        </Text>
                                    </View>
                                    <View>
                                        <View
                                            style={{ bottom: 15, margin: 10 }}
                                        >
                                            <Button
                                                title={localeString(
                                                    'views.Settings.LightningAddress.get0ConfChan'
                                                )}
                                                onPress={() => {
                                                    UnitsStore.resetUnits();
                                                    navigation.navigate(
                                                        'Receive',
                                                        {
                                                            amount: '100000'
                                                        }
                                                    );
                                                }}
                                            />
                                        </View>
                                        <View
                                            style={{ bottom: 15, margin: 10 }}
                                        >
                                            <Button
                                                title={localeString(
                                                    'views.LspExplanation.buttonText2'
                                                )}
                                                onPress={() =>
                                                    navigation.navigate(
                                                        'LspExplanationOverview'
                                                    )
                                                }
                                                tertiary
                                            />
                                        </View>
                                        <View
                                            style={{ bottom: 15, margin: 10 }}
                                        >
                                            <Button
                                                title={localeString(
                                                    'views.Intro.lightningOnboarding'
                                                )}
                                                onPress={() =>
                                                    UrlUtils.goToUrl(
                                                        'https://docs.zeusln.app/for-users/embedded-node/lightning-onboarding/'
                                                    )
                                                }
                                                secondary
                                            />
                                        </View>
                                        <View
                                            style={{ bottom: 15, margin: 10 }}
                                        >
                                            <Button
                                                title={localeString(
                                                    'views.Intro.lightningLiquidity'
                                                )}
                                                onPress={() =>
                                                    UrlUtils.goToUrl(
                                                        'https://bitcoin.design/guide/how-it-works/liquidity/'
                                                    )
                                                }
                                                secondary
                                            />
                                        </View>
                                    </View>
                                </>
                            )}
                        {lightningAddressHandle && (
                            <>
                                {!isReady &&
                                    !loading &&
                                    !redeeming &&
                                    paid &&
                                    paid.length > 0 && (
                                        <>
                                            <View
                                                style={{
                                                    alignSelf: 'center'
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        fontFamily:
                                                            'PPNeueMontreal-Medium',
                                                        color: themeColor(
                                                            'highlight'
                                                        ),
                                                        margin: 5,
                                                        alignSelf: 'center',
                                                        marginTop: 10,
                                                        marginBottom: 10
                                                    }}
                                                >
                                                    {localeString(
                                                        'views.PaymentRequest.lndGettingReadyReceive'
                                                    )}
                                                </Text>
                                                <LoadingIndicator size={30} />
                                            </View>
                                        </>
                                    )}
                                {!loading && !redeeming && paid.length === 0 && (
                                    <TouchableOpacity
                                        style={{
                                            marginTop: 15,
                                            alignItems: 'center'
                                        }}
                                        onPress={() => status()}
                                    >
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.LightningAddress.noPaymentsToRedeem'
                                            )}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {!loading && !redeeming && (
                                    <>
                                        <FlatList
                                            data={paid}
                                            renderItem={({
                                                item,
                                                index
                                            }: {
                                                item: any;
                                                index: number;
                                            }) => {
                                                return (
                                                    <LightningAddressPayment
                                                        index={index}
                                                        item={item}
                                                        navigation={navigation}
                                                        isReady={isReady}
                                                    />
                                                );
                                            }}
                                            ListFooterComponent={
                                                <Spacer height={100} />
                                            }
                                            onRefresh={() => status()}
                                            refreshing={loading}
                                            keyExtractor={(_, index) =>
                                                `${index}`
                                            }
                                        />
                                        {paid && paid.length > 0 && (
                                            <Button
                                                title={localeString(
                                                    'views.Settings.LightningAddress.redeemAll'
                                                )}
                                                onPress={() =>
                                                    redeemAllOpenPayments()
                                                }
                                                disabled={!isReady}
                                            />
                                        )}
                                    </>
                                )}
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
        fontSize: 16.5,
        marginBottom: 10
    },
    wrapper: {
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 15,
        paddingRight: 15
    }
});
