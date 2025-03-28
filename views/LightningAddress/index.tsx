import * as React from 'react';
import {
    Dimensions,
    FlatList,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
// @ts-ignore:next-line
import { generatePrivateKey, getPublicKey, nip19 } from 'nostr-tools';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import ZaplockerPayment from './ZaplockerPayment';
import CashuPayment from './CashuPayment';

import Button from '../../components/Button';
import KeyValue from '../../components/KeyValue';
import Pill from '../../components/Pill';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import Header from '../../components/Header';
import LightningLoadingPattern from '../../components/LightningLoadingPattern';
import LoadingIndicator from '../../components/LoadingIndicator';
import TextInput from '../../components/TextInput';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { Row } from '../../components/layout/Row';
import { Spacer } from '../../components/layout/Spacer';

import ChannelsStore from '../../stores/ChannelsStore';
import LightningAddressStore from '../../stores/LightningAddressStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore, {
    DEFAULT_LSPS1_PUBKEY_MAINNET,
    DEFAULT_NOSTR_RELAYS
} from '../../stores/SettingsStore';
import UnitsStore from '../../stores/UnitsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import CaretDown from '../../assets/images/SVG/Caret Down.svg';
import CaretRight from '../../assets/images/SVG/Caret Right.svg';
import QR from '../../assets/images/SVG/QR.svg';
import Gear from '../../assets/images/SVG/Gear.svg';
import ZeusPayIcon from '../../assets/images/SVG/zeus-pay.svg';

interface LightningAddressProps {
    navigation: StackNavigationProp<any, any>;
    ChannelsStore: ChannelsStore;
    LightningAddressStore: LightningAddressStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
    route: Route<
        'LightningAddress',
        { skipStatus: boolean; relays: string[]; nostrPrivateKey: string }
    >;
}

interface LightningAddressState {
    newLightningAddress: string;
    nostrPrivateKey: string;
    nostrPublicKey: string;
    nostrNpub: string;
    nostrRelays: Array<string>;
    hasZeusLspChannel: boolean;
    prosConsCashu: boolean;
    prosConsZaplocker: boolean;
    prosConsRemote: boolean;
}

@inject(
    'LightningAddressStore',
    'NodeInfoStore',
    'ChannelsStore',
    'SettingsStore',
    'UnitsStore'
)
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
        nostrRelays: DEFAULT_NOSTR_RELAYS,
        hasZeusLspChannel: false,
        prosConsCashu: false,
        prosConsZaplocker: false,
        prosConsRemote: false
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
        const { ChannelsStore, LightningAddressStore, navigation, route } =
            this.props;
        const { status } = LightningAddressStore;

        const skipStatus = route.params?.skipStatus;

        this.generateNostrKeys();

        this.setState({
            newLightningAddress: ''
        });

        if (!skipStatus) status();

        ChannelsStore.enrichedChannels?.every((channel) => {
            if (channel.remotePubkey === DEFAULT_LSPS1_PUBKEY_MAINNET) {
                this.setState({
                    hasZeusLspChannel: true
                });
                return false;
            }
            return true;
        });

        // triggers when loaded from navigation or back action
        navigation.addListener('focus', this.handleFocus);
    }

    handleFocus = () => {
        if (this.isInitialFocus) {
            this.isInitialFocus = false;
        } else {
            this.props.LightningAddressStore.status();
        }
    };

    UNSAFE_componentWillReceiveProps = (newProps: LightningAddressProps) => {
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
        const {
            navigation,
            LightningAddressStore,
            NodeInfoStore,
            SettingsStore,
            UnitsStore
        } = this.props;
        const {
            newLightningAddress,
            nostrPrivateKey,
            nostrPublicKey,
            nostrNpub,
            nostrRelays,
            hasZeusLspChannel,
            prosConsCashu,
            prosConsZaplocker,
            prosConsRemote
        } = this.state;
        const {
            createZaplocker,
            status,
            redeemAllOpenPaymentsZaplocker,
            redeemAllOpenPaymentsCashu,
            DEV_deleteLocalHashes,
            lightningAddressHandle,
            lightningAddressDomain,
            lightningAddressType,
            availableHashes,
            localHashes,
            paid,
            fees,
            error_msg,
            loading,
            redeeming,
            redeemingAll,
            readyToAutomaticallyAccept,
            prepareToAutomaticallyAcceptStart,
            deleteAndGenerateNewPreimages
        } = LightningAddressStore;

        const { fontScale } = Dimensions.get('window');

        const automaticallyAccept =
            SettingsStore.settings?.lightningAddress?.automaticallyAccept;
        const notEmbedded = SettingsStore.implementation !== 'embedded-lnd';
        const isReady =
            notEmbedded ||
            !prepareToAutomaticallyAcceptStart ||
            !automaticallyAccept ||
            readyToAutomaticallyAccept;
        const cashuEnabled = SettingsStore.settings?.ecash?.enableCashu;

        const { flowLspNotConfigured } = NodeInfoStore.flowLspNotConfigured();
        const supportsLSPS1 =
            BackendUtils.supportsLSPScustomMessage() ||
            BackendUtils.supportsLSPS1rest();

        const InfoButton = () => (
            <View style={{ right: 15 }}>
                <Icon
                    name="info"
                    onPress={() => {
                        if (lightningAddressType === 'zaplocker') {
                            navigation.navigate('ZaplockerInfo');
                        } else if (lightningAddressType === 'cashu') {
                            navigation.navigate('CashuLightningAddressInfo');
                        }
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
                    if (lightningAddressType === 'zaplocker') {
                        navigation.navigate('LightningAddressSettings');
                    } else if (lightningAddressType === 'cashu') {
                        navigation.navigate('CashuLightningAddressSettings');
                    }
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
                            logo: themeColor('invertQrIcons')
                                ? require('../../assets/images/pay-z-white.png')
                                : require('../../assets/images/pay-z-black.png')
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
                        centerComponent={
                            <ZeusPayIcon
                                fill={themeColor('text')}
                                width={30}
                                height={30}
                            />
                        }
                        rightComponent={
                            !loading && !redeeming && !redeemingAll ? (
                                <Row>
                                    {lightningAddressHandle && fees && (
                                        <InfoButton />
                                    )}
                                    {lightningAddressHandle && (
                                        <SettingsButton />
                                    )}
                                </Row>
                            ) : undefined
                        }
                        navigation={navigation}
                    />
                    {redeeming && <LightningLoadingPattern />}
                    {redeemingAll && !redeeming && (
                        <LightningLoadingPattern color={themeColor('text')} />
                    )}
                    <View style={{ flex: 1, margin: 5 }}>
                        {loading && <LoadingIndicator />}
                        {!loading && !redeeming && !!error_msg && (
                            <ErrorMessage message={error_msg} dismissable />
                        )}
                        {!loading &&
                            !redeeming &&
                            error_msg ===
                                localeString(
                                    'stores.LightningAddressStore.preimageNotFound'
                                ) && (
                                <Button
                                    title={localeString(
                                        'views.Settings.LightningAddress.generateNew'
                                    )}
                                    onPress={() =>
                                        deleteAndGenerateNewPreimages()
                                    }
                                />
                            )}
                        {!loading &&
                            !redeemingAll &&
                            !redeeming &&
                            lightningAddressHandle && (
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
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                fontSize: 26 / fontScale,
                                                color: themeColor('text'),
                                                textAlign: 'center'
                                            }}
                                        >
                                            {`${lightningAddressHandle}@${lightningAddressDomain}`}
                                        </Text>
                                    </Row>
                                    {lightningAddressType === 'zaplocker' && (
                                        <Row
                                            style={{
                                                alignSelf: 'center',
                                                marginTop: 4
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontFamily:
                                                        'PPNeueMontreal-Book',

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
                                                    fontFamily:
                                                        'PPNeueMontreal-Book',
                                                    color: statusGood
                                                        ? themeColor('success')
                                                        : themeColor('error'),
                                                    textAlign: 'center'
                                                }}
                                            >
                                                {statusGood
                                                    ? localeString(
                                                          'general.good'
                                                      )
                                                    : localeString(
                                                          'general.bad'
                                                      )}
                                            </Text>
                                            <Text
                                                style={{
                                                    fontFamily:
                                                        'PPNeueMontreal-Book',
                                                    fontSize: 11,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    left: 5
                                                }}
                                                infoModalText={[
                                                    localeString(
                                                        'views.Settings.LightningAddress.statusExplainer1'
                                                    ),
                                                    localeString(
                                                        'views.Settings.LightningAddress.statusExplainer2'
                                                    )
                                                ]}
                                            >
                                                {` (${
                                                    __DEV__
                                                        ? `${localHashes}|`
                                                        : ''
                                                }${availableHashes})`}
                                            </Text>
                                        </Row>
                                    )}
                                    <QRButton />
                                </View>
                            )}
                        {!loading &&
                            !redeeming &&
                            !redeemingAll &&
                            !lightningAddressHandle &&
                            hasZeusLspChannel && (
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
                                </>
                            )}
                        {!loading &&
                            !redeeming &&
                            !redeemingAll &&
                            !lightningAddressHandle && (
                                <>
                                    <View
                                        style={{
                                            flex: 1,
                                            marginLeft: 5,
                                            marginRight: 5
                                        }}
                                    >
                                        <ScrollView style={{ margin: 10 }}>
                                            <Text
                                                style={{
                                                    ...styles.explainer,
                                                    color: themeColor('text')
                                                }}
                                            >
                                                {localeString(
                                                    'zeuspay.intro.explainer1'
                                                )}
                                            </Text>
                                            <Text
                                                style={{
                                                    ...styles.explainer,
                                                    color: themeColor('text')
                                                }}
                                            >
                                                {localeString(
                                                    'zeuspay.intro.explainer2'
                                                )}
                                            </Text>

                                            {BackendUtils.supportsCashu() && (
                                                <View
                                                    style={styles.optionBlock}
                                                >
                                                    <Row justify="space-between">
                                                        <Text
                                                            style={{
                                                                ...styles.explainer,
                                                                fontWeight:
                                                                    'bold',
                                                                fontSize: 30,
                                                                color: themeColor(
                                                                    'text'
                                                                )
                                                            }}
                                                        >
                                                            {localeString(
                                                                'general.ecash'
                                                            )}
                                                        </Text>
                                                        <View
                                                            style={{
                                                                marginLeft: 15
                                                            }}
                                                        >
                                                            <Pill
                                                                title={localeString(
                                                                    'general.custodial'
                                                                ).toUpperCase()}
                                                                textColor={themeColor(
                                                                    'highlight'
                                                                )}
                                                                borderColor={themeColor(
                                                                    'highlight'
                                                                )}
                                                                width={160}
                                                                height={25}
                                                            />
                                                        </View>
                                                    </Row>

                                                    <Text
                                                        style={{
                                                            ...styles.explainer,
                                                            color: themeColor(
                                                                'text'
                                                            )
                                                        }}
                                                    >
                                                        {localeString(
                                                            'zeuspay.intro.ecash.overview'
                                                        )}
                                                    </Text>

                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            this.setState({
                                                                prosConsCashu:
                                                                    !prosConsCashu
                                                            });
                                                        }}
                                                    >
                                                        <View
                                                            style={
                                                                styles.prosConsToggle
                                                            }
                                                        >
                                                            <Row justify="space-between">
                                                                <Text
                                                                    style={{
                                                                        ...styles.explainer,
                                                                        fontWeight:
                                                                            'bold',
                                                                        color: themeColor(
                                                                            'text'
                                                                        )
                                                                    }}
                                                                >
                                                                    {localeString(
                                                                        'zeuspay.intro.prosAndCons'
                                                                    )}
                                                                </Text>
                                                                {prosConsCashu ? (
                                                                    <CaretDown
                                                                        fill={themeColor(
                                                                            'text'
                                                                        )}
                                                                        width="20"
                                                                        height="20"
                                                                    />
                                                                ) : (
                                                                    <CaretRight
                                                                        fill={themeColor(
                                                                            'text'
                                                                        )}
                                                                        width="20"
                                                                        height="20"
                                                                    />
                                                                )}
                                                            </Row>
                                                        </View>
                                                    </TouchableOpacity>

                                                    {prosConsCashu && (
                                                        <View
                                                            style={
                                                                styles.prosCons
                                                            }
                                                        >
                                                            <Row justify="space-between">
                                                                <View
                                                                    style={
                                                                        styles.prosConsColumn
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={{
                                                                            ...styles.explainer,
                                                                            color: themeColor(
                                                                                'text'
                                                                            )
                                                                        }}
                                                                    >
                                                                        {`🟢 ${localeString(
                                                                            'zeuspay.intro.prosAndCons.settledUponPayment'
                                                                        )}`}
                                                                    </Text>
                                                                    <Text
                                                                        style={{
                                                                            ...styles.explainer,
                                                                            color: themeColor(
                                                                                'text'
                                                                            )
                                                                        }}
                                                                    >
                                                                        {`🟢 ${localeString(
                                                                            'zeuspay.intro.prosAndCons.noExpiry'
                                                                        )}`}
                                                                    </Text>
                                                                    <Text
                                                                        style={{
                                                                            ...styles.explainer,
                                                                            color: themeColor(
                                                                                'text'
                                                                            )
                                                                        }}
                                                                    >
                                                                        {`🟢 ${localeString(
                                                                            'zeuspay.intro.prosAndCons.noLspChannelNeeded'
                                                                        )}`}
                                                                    </Text>
                                                                </View>
                                                                <View
                                                                    style={
                                                                        styles.prosConsColumn
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={{
                                                                            ...styles.explainer,
                                                                            color: themeColor(
                                                                                'text'
                                                                            )
                                                                        }}
                                                                    >
                                                                        {`🔴 ${localeString(
                                                                            'general.custodial'
                                                                        )}`}
                                                                    </Text>
                                                                    <Text
                                                                        style={{
                                                                            ...styles.explainer,
                                                                            color: themeColor(
                                                                                'text'
                                                                            )
                                                                        }}
                                                                    >
                                                                        {`🔴 ${localeString(
                                                                            'zeuspay.intro.prosAndCons.redeemInApp'
                                                                        )}`}
                                                                    </Text>
                                                                </View>
                                                            </Row>
                                                        </View>
                                                    )}
                                                    <Row>
                                                        <View
                                                            style={{
                                                                margin: 2,
                                                                width: '50%'
                                                            }}
                                                        >
                                                            <Button
                                                                title={localeString(
                                                                    'general.learnMore'
                                                                )}
                                                                onPress={() =>
                                                                    navigation.navigate(
                                                                        'CashuLightningAddressInfo'
                                                                    )
                                                                }
                                                                secondary
                                                            />
                                                        </View>
                                                        <View
                                                            style={{
                                                                margin: 2,
                                                                width: '50%'
                                                            }}
                                                        >
                                                            <Button
                                                                title={
                                                                    cashuEnabled
                                                                        ? localeString(
                                                                              'general.getStarted'
                                                                          )
                                                                        : localeString(
                                                                              'zeuspay.enableEcash'
                                                                          )
                                                                }
                                                                onPress={() =>
                                                                    navigation.navigate(
                                                                        cashuEnabled
                                                                            ? 'CreateCashuLightningAddress'
                                                                            : 'EcashSettings'
                                                                    )
                                                                }
                                                            />
                                                        </View>
                                                    </Row>
                                                </View>
                                            )}

                                            <View style={styles.optionBlock}>
                                                <Row justify="space-between">
                                                    <Text
                                                        style={{
                                                            ...styles.explainer,
                                                            fontWeight: 'bold',
                                                            fontSize: 30,
                                                            color: themeColor(
                                                                'text'
                                                            )
                                                        }}
                                                    >
                                                        Zaplocker
                                                    </Text>
                                                    <View
                                                        style={{
                                                            marginLeft: 15
                                                        }}
                                                    >
                                                        <Pill
                                                            title={localeString(
                                                                'general.selfCustodial'
                                                            ).toUpperCase()}
                                                            textColor={themeColor(
                                                                'success'
                                                            )}
                                                            borderColor={themeColor(
                                                                'success'
                                                            )}
                                                            width={160}
                                                            height={25}
                                                        />
                                                    </View>
                                                </Row>

                                                <Text
                                                    style={{
                                                        ...styles.explainer,
                                                        color: themeColor(
                                                            'text'
                                                        )
                                                    }}
                                                >
                                                    {localeString(
                                                        'zeuspay.intro.zaplocker.overview'
                                                    )}
                                                </Text>

                                                <TouchableOpacity
                                                    onPress={() => {
                                                        this.setState({
                                                            prosConsZaplocker:
                                                                !prosConsZaplocker
                                                        });
                                                    }}
                                                >
                                                    <View
                                                        style={
                                                            styles.prosConsToggle
                                                        }
                                                    >
                                                        <Row justify="space-between">
                                                            <Text
                                                                style={{
                                                                    ...styles.explainer,
                                                                    fontWeight:
                                                                        'bold',
                                                                    color: themeColor(
                                                                        'text'
                                                                    )
                                                                }}
                                                            >
                                                                {localeString(
                                                                    'zeuspay.intro.prosAndCons'
                                                                )}
                                                            </Text>
                                                            {prosConsZaplocker ? (
                                                                <CaretDown
                                                                    fill={themeColor(
                                                                        'text'
                                                                    )}
                                                                    width="20"
                                                                    height="20"
                                                                />
                                                            ) : (
                                                                <CaretRight
                                                                    fill={themeColor(
                                                                        'text'
                                                                    )}
                                                                    width="20"
                                                                    height="20"
                                                                />
                                                            )}
                                                        </Row>
                                                    </View>
                                                </TouchableOpacity>

                                                {prosConsZaplocker && (
                                                    <View
                                                        style={styles.prosCons}
                                                    >
                                                        <Row justify="space-between">
                                                            <View
                                                                style={
                                                                    styles.prosConsColumn
                                                                }
                                                            >
                                                                <Text
                                                                    style={{
                                                                        ...styles.explainer,
                                                                        color: themeColor(
                                                                            'text'
                                                                        )
                                                                    }}
                                                                >
                                                                    {`🟢 ${localeString(
                                                                        'general.selfCustodial'
                                                                    )}`}
                                                                </Text>
                                                                <Text
                                                                    style={{
                                                                        ...styles.explainer,
                                                                        color: themeColor(
                                                                            'text'
                                                                        )
                                                                    }}
                                                                >
                                                                    {`🟢 ${localeString(
                                                                        'zeuspay.intro.prosAndCons.nostrVerification'
                                                                    )}`}
                                                                </Text>
                                                            </View>
                                                            <View
                                                                style={
                                                                    styles.prosConsColumn
                                                                }
                                                            >
                                                                <Text
                                                                    style={{
                                                                        ...styles.explainer,
                                                                        color: themeColor(
                                                                            'text'
                                                                        )
                                                                    }}
                                                                >
                                                                    {`🔴 ${localeString(
                                                                        'zeuspay.intro.prosAndCons.redeemInApp'
                                                                    )}`}
                                                                </Text>
                                                                <Text
                                                                    style={{
                                                                        ...styles.explainer,
                                                                        color: themeColor(
                                                                            'text'
                                                                        )
                                                                    }}
                                                                >
                                                                    {`🔴 ${localeString(
                                                                        'zeuspay.intro.prosAndCons.settledUponRedemption'
                                                                    )}`}
                                                                </Text>
                                                                <Text
                                                                    style={{
                                                                        ...styles.explainer,
                                                                        color: themeColor(
                                                                            'text'
                                                                        )
                                                                    }}
                                                                >
                                                                    {`🔴 ${localeString(
                                                                        'zeuspay.intro.prosAndCons.24hrs'
                                                                    )}`}
                                                                </Text>
                                                                <Text
                                                                    style={{
                                                                        ...styles.explainer,
                                                                        color: themeColor(
                                                                            'text'
                                                                        )
                                                                    }}
                                                                >
                                                                    {`🔴 ${localeString(
                                                                        'zeuspay.intro.prosAndCons.channelRequired'
                                                                    )}`}
                                                                </Text>
                                                            </View>
                                                        </Row>
                                                    </View>
                                                )}

                                                <Row>
                                                    <View
                                                        style={{
                                                            margin: 2,
                                                            width: '50%'
                                                        }}
                                                    >
                                                        <Button
                                                            title={localeString(
                                                                'general.learnMore'
                                                            )}
                                                            onPress={() =>
                                                                navigation.navigate(
                                                                    'ZaplockerInfo'
                                                                )
                                                            }
                                                            secondary
                                                        />
                                                    </View>
                                                    <View
                                                        style={{
                                                            margin: 2,
                                                            width: '50%'
                                                        }}
                                                    >
                                                        <Button
                                                            title={
                                                                hasZeusLspChannel
                                                                    ? localeString(
                                                                          'general.getStarted'
                                                                      )
                                                                    : localeString(
                                                                          'zeuspay.getChannel'
                                                                      )
                                                            }
                                                            // TODO ecash
                                                            onPress={() =>
                                                                navigation.navigate(
                                                                    true ||
                                                                        hasZeusLspChannel
                                                                        ? 'CreateZaplockerLightningAddress'
                                                                        : 'ZaplockerGetChan'
                                                                )
                                                            }
                                                        />
                                                    </View>
                                                </Row>
                                            </View>

                                            {notEmbedded && (
                                                <View
                                                    style={styles.optionBlock}
                                                >
                                                    <Row justify="space-between">
                                                        <Text
                                                            style={{
                                                                ...styles.explainer,
                                                                fontWeight:
                                                                    'bold',
                                                                fontSize: 30,
                                                                color: themeColor(
                                                                    'text'
                                                                )
                                                            }}
                                                        >
                                                            {localeString(
                                                                'general.remote'
                                                            )}
                                                        </Text>
                                                        <View
                                                            style={{
                                                                marginLeft: 15
                                                            }}
                                                        >
                                                            <Pill
                                                                title={localeString(
                                                                    'general.selfCustodial'
                                                                ).toUpperCase()}
                                                                textColor={themeColor(
                                                                    'success'
                                                                )}
                                                                borderColor={themeColor(
                                                                    'success'
                                                                )}
                                                                width={160}
                                                                height={25}
                                                            />
                                                        </View>
                                                    </Row>

                                                    <Text
                                                        style={{
                                                            ...styles.explainer,
                                                            color: themeColor(
                                                                'text'
                                                            )
                                                        }}
                                                    >
                                                        {localeString(
                                                            'zeuspay.intro.nwc.overview'
                                                        )}
                                                    </Text>

                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            this.setState({
                                                                prosConsRemote:
                                                                    !prosConsRemote
                                                            });
                                                        }}
                                                    >
                                                        <View
                                                            style={
                                                                styles.prosConsToggle
                                                            }
                                                        >
                                                            <Row justify="space-between">
                                                                <Text
                                                                    style={{
                                                                        ...styles.explainer,
                                                                        fontWeight:
                                                                            'bold',
                                                                        color: themeColor(
                                                                            'text'
                                                                        )
                                                                    }}
                                                                >
                                                                    {localeString(
                                                                        'zeuspay.intro.prosAndCons'
                                                                    )}
                                                                </Text>
                                                                {prosConsRemote ? (
                                                                    <CaretDown
                                                                        fill={themeColor(
                                                                            'text'
                                                                        )}
                                                                        width="20"
                                                                        height="20"
                                                                    />
                                                                ) : (
                                                                    <CaretRight
                                                                        fill={themeColor(
                                                                            'text'
                                                                        )}
                                                                        width="20"
                                                                        height="20"
                                                                    />
                                                                )}
                                                            </Row>
                                                        </View>
                                                    </TouchableOpacity>

                                                    {prosConsRemote && (
                                                        <View
                                                            style={
                                                                styles.prosCons
                                                            }
                                                        >
                                                            <Row justify="space-between">
                                                                <View
                                                                    style={
                                                                        styles.prosConsColumn
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={{
                                                                            ...styles.explainer,
                                                                            color: themeColor(
                                                                                'text'
                                                                            )
                                                                        }}
                                                                    >
                                                                        {`🟢 ${localeString(
                                                                            'general.selfCustodial'
                                                                        )}`}
                                                                    </Text>
                                                                    <Text
                                                                        style={{
                                                                            ...styles.explainer,
                                                                            color: themeColor(
                                                                                'text'
                                                                            )
                                                                        }}
                                                                    >
                                                                        {`🟢 ${localeString(
                                                                            'zeuspay.intro.prosAndCons.automaticallyAccepted'
                                                                        )}`}
                                                                    </Text>
                                                                    <Text
                                                                        style={{
                                                                            ...styles.explainer,
                                                                            color: themeColor(
                                                                                'text'
                                                                            )
                                                                        }}
                                                                    >
                                                                        {`🟢 ${localeString(
                                                                            'zeuspay.intro.prosAndCons.noLspChannelNeeded'
                                                                        )}`}
                                                                    </Text>
                                                                </View>
                                                                <View
                                                                    style={
                                                                        styles.prosConsColumn
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={{
                                                                            ...styles.explainer,
                                                                            color: themeColor(
                                                                                'text'
                                                                            )
                                                                        }}
                                                                    >
                                                                        {`🔴 ${localeString(
                                                                            'zeuspay.intro.prosAndCons.remotePlusNwc'
                                                                        )}`}
                                                                    </Text>
                                                                    <Text
                                                                        style={{
                                                                            ...styles.explainer,
                                                                            color: themeColor(
                                                                                'text'
                                                                            )
                                                                        }}
                                                                    >
                                                                        {`🔴 ${localeString(
                                                                            'zeuspay.intro.prosAndCons.payPlusSubscription'
                                                                        )}`}
                                                                    </Text>
                                                                </View>
                                                            </Row>
                                                        </View>
                                                    )}
                                                    <Row>
                                                        <View
                                                            style={{
                                                                marginTop: 10,
                                                                marginBottom: 10,
                                                                width: '100%'
                                                            }}
                                                        >
                                                            <Button
                                                                title={localeString(
                                                                    'general.comingSoon'
                                                                )}
                                                                disabled
                                                            />
                                                        </View>
                                                    </Row>
                                                </View>
                                            )}
                                        </ScrollView>
                                        {false && (
                                            <View style={{ bottom: 10 }}>
                                                {BackendUtils.supportsFlowLSP() &&
                                                    !flowLspNotConfigured && (
                                                        <View
                                                            style={{
                                                                margin: 10
                                                            }}
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
                                                    )}

                                                {supportsLSPS1 &&
                                                    !flowLspNotConfigured && (
                                                        <View
                                                            style={{
                                                                margin: 10
                                                            }}
                                                        >
                                                            <Button
                                                                title={localeString(
                                                                    'views.Settings.LightningAddress.getStandardChan'
                                                                )}
                                                                onPress={() => {
                                                                    navigation.navigate(
                                                                        'LSPS1'
                                                                    );
                                                                }}
                                                            />
                                                        </View>
                                                    )}
                                                <View style={{ margin: 10 }}>
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
                                        )}
                                    </View>
                                </>
                            )}
                        {lightningAddressHandle && (
                            <>
                                {!isReady &&
                                    !loading &&
                                    !redeeming &&
                                    !redeemingAll &&
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
                                {!loading &&
                                    !redeeming &&
                                    !redeemingAll &&
                                    paid.length === 0 && (
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

                                {!loading && !redeeming && !redeemingAll && (
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
                                                if (
                                                    lightningAddressType ===
                                                    'zaplocker'
                                                ) {
                                                    return (
                                                        <ZaplockerPayment
                                                            index={index}
                                                            item={item}
                                                            navigation={
                                                                navigation
                                                            }
                                                            isReady={isReady}
                                                        />
                                                    );
                                                } else if (
                                                    lightningAddressType ===
                                                    'cashu'
                                                ) {
                                                    return (
                                                        <CashuPayment
                                                            index={index}
                                                            item={item}
                                                            navigation={
                                                                navigation
                                                            }
                                                        />
                                                    );
                                                }
                                                return null;
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
                                                onPress={() => {
                                                    if (
                                                        lightningAddressType ===
                                                        'zaplocker'
                                                    ) {
                                                        redeemAllOpenPaymentsZaplocker();
                                                    } else if (
                                                        lightningAddressType ===
                                                        'cashu'
                                                    ) {
                                                        redeemAllOpenPaymentsCashu();
                                                    }
                                                }}
                                                disabled={!isReady}
                                            />
                                        )}
                                        {__DEV__ &&
                                            lightningAddressType ===
                                                'zaplocker' && (
                                                <View style={{ marginTop: 10 }}>
                                                    <Button
                                                        title={
                                                            'Clear local hashes'
                                                        }
                                                        onPress={() =>
                                                            DEV_deleteLocalHashes()
                                                        }
                                                        secondary
                                                    />
                                                </View>
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
