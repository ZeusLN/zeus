import * as React from 'react';
import {
    Dimensions,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { ButtonGroup, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { generatePrivateKey, getPublicKey, nip19 } from 'nostr-tools';

import LightningAddressPayment from './LightningAddressPayment';

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
import { Spacer } from '../../../components/layout/Spacer';

import ChannelsStore from '../../../stores/ChannelsStore';
import LightningAddressStore from '../../../stores/LightningAddressStore';
import SettingsStore, {
    DEFAULT_NOSTR_RELAYS
} from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import QR from '../../../assets/images/SVG/QR.svg';
import Gear from '../../../assets/images/SVG/Gear.svg';

interface LightningAddressProps {
    navigation: any;
    ChannelsStore: ChannelsStore;
    LightningAddressStore: LightningAddressStore;
    SettingsStore: SettingsStore;
}

interface LightningAddressState {
    selectedIndex: number;
    newLightningAddress: string;
    nostrPrivateKey: string;
    nostrPublicKey: string;
    nostrNpub: string;
    nostrRelays: Array<string>;
}

@inject('LightningAddressStore', 'ChannelsStore', 'SettingsStore')
@observer
export default class LightningAddress extends React.Component<
    LightningAddressProps,
    LightningAddressState
> {
    isInitialFocus = true;

    state = {
        selectedIndex: 0,
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

        this.generateNostrKeys();

        this.setState({
            newLightningAddress: ''
        });

        status();

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
            SettingsStore
        } = this.props;
        const {
            newLightningAddress,
            nostrPrivateKey,
            nostrPublicKey,
            nostrNpub,
            selectedIndex,
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
            settled,
            fees,
            error,
            error_msg,
            loading,
            readyToAutomaticallyAccept,
            prepareToAutomaticallyAcceptStart
        } = LightningAddressStore;

        const { fontScale } = Dimensions.get('window');

        const automaticallyAccept =
            SettingsStore.settings?.lightningAddress?.automaticallyAccept;
        const automaticallyRequestOlympusChannels =
            SettingsStore.settings?.lightningAddress
                ?.automaticallyRequestOlympusChannels;
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

        const QRButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('QR', {
                        value: `${lightningAddressHandle}@${lightningAddressDomain}`,
                        hideText: true,
                        jumboLabel: true,
                        logo: require('../../../assets/images/pay-z-black.png')
                    })
                }
                style={{ marginTop: 10 }}
            >
                <QR fill={themeColor('text')} style={{ alignSelf: 'center' }} />
            </TouchableOpacity>
        );

        const statusGood = availableHashes > 50;

        const openOrdersButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        selectedIndex === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {`${localeString('general.open')} (${paid.length})`}
            </Text>
        );

        const paidOrdersButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        selectedIndex === 1
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {`${localeString('general.settled')} (${settled.length})`}
            </Text>
        );

        const buttons = [
            { element: openOrdersButton },
            { element: paidOrdersButton }
        ];

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
                            !loading ? (
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
                    <View style={{ flex: 1, margin: 5 }}>
                        {loading && <LoadingIndicator />}
                        {!loading && !!error_msg && (
                            <ErrorMessage message={error_msg} dismissable />
                        )}
                        {!loading && lightningAddressHandle && (
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
                        {!loading && lightningAddressHandle && !hasChannels && (
                            <WarningMessage
                                message={
                                    // TODO add new dynamic fee logic here for chan opens
                                    automaticallyRequestOlympusChannels &&
                                    SettingsStore.implementation ===
                                        'embedded-lnd'
                                        ? `${localeString(
                                              'views.Settings.LightningAddress.receiveExplainer1'
                                          )} ${localeString(
                                              'views.Settings.LightningAddress.receiveExplainer2'
                                          )}`
                                        : localeString(
                                              'views.Settings.LightningAddress.receiveExplainer1'
                                          )
                                }
                                dismissable
                            />
                        )}
                        {!loading && !lightningAddressHandle && (
                            <>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.wrapper}>
                                        <Text style={styles.text}>
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
                                <View>
                                    <View style={{ bottom: 15, margin: 10 }}>
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
                        {lightningAddressHandle && (
                            <>
                                {!loading && (
                                    <ButtonGroup
                                        onPress={(selectedIndex: number) => {
                                            this.setState({ selectedIndex });
                                        }}
                                        selectedIndex={selectedIndex}
                                        buttons={buttons}
                                        selectedButtonStyle={{
                                            backgroundColor:
                                                themeColor('highlight'),
                                            borderRadius: 12
                                        }}
                                        containerStyle={{
                                            backgroundColor:
                                                themeColor('secondary'),
                                            borderRadius: 12,
                                            borderColor: themeColor('secondary')
                                        }}
                                        innerBorderStyle={{
                                            color: themeColor('secondary')
                                        }}
                                    />
                                )}
                                {!isReady &&
                                    !loading &&
                                    selectedIndex === 0 &&
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
                                    selectedIndex === 0 &&
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
                                                    'views.Settings.LightningAddress.noOpenPayments'
                                                )}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                {!loading &&
                                    selectedIndex === 1 &&
                                    settled.length === 0 && (
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
                                                    'views.Settings.LightningAddress.noSettledPayments'
                                                )}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                {!loading && selectedIndex === 0 && (
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
                                                        selectedIndex={
                                                            selectedIndex
                                                        }
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
                                {!loading && selectedIndex === 1 && (
                                    <FlatList
                                        data={settled}
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
                                                    selectedIndex={
                                                        selectedIndex
                                                    }
                                                    navigation={navigation}
                                                />
                                            );
                                        }}
                                        ListFooterComponent={
                                            <Spacer height={100} />
                                        }
                                        onRefresh={() => status()}
                                        refreshing={loading}
                                        keyExtractor={(_, index) => `${index}`}
                                    />
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
        fontFamily: 'PPNeueMontreal-Book',
        color: themeColor('text')
    },
    wrapper: {
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 15,
        paddingRight: 15
    }
});
