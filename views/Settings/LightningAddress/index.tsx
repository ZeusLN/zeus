import * as React from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ButtonGroup, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { generatePrivateKey, getPublicKey, nip19 } from 'nostr-tools';

import LightningAddressPayment from './LightningAddressPayment';

import Button from '../../../components/Button';
import KeyValue from '../../../components/KeyValue';
import Screen from '../../../components/Screen';
import Switch from '../../../components/Switch';
import Text from '../../../components/Text';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import TextInput from '../../../components/TextInput';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import { Row } from '../../../components/layout/Row';
import { Spacer } from '../../../components/layout/Spacer';

import LightningAddressStore from '../../../stores/LightningAddressStore';
import SettingsStore from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import DiceSVG from '../../../assets/images/SVG/Dice.svg';

interface LightningAddressProps {
    navigation: any;
    LightningAddressStore: LightningAddressStore;
    SettingsStore: SettingsStore;
}

interface LightningAddressState {
    selectedIndex: number;
    newLightningAddress: string;
    enableZaplockerVerification: boolean;
    nostrPrivateKey: string;
    nostrPublicKey: string;
    nostrNpub: string;
}

@inject('LightningAddressStore', 'SettingsStore')
@observer
export default class LightningAddress extends React.Component<
    LightningAddressProps,
    LightningAddressState
> {
    state = {
        selectedIndex: 0,
        newLightningAddress: '',
        enableZaplockerVerification: true,
        nostrPrivateKey: '',
        nostrPublicKey: '',
        nostrNpub: ''
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

    async UNSAFE_componentWillMount() {
        const { LightningAddressStore } = this.props;
        const { status } = LightningAddressStore;

        status();

        this.generateNostrKeys();

        this.setState({
            newLightningAddress: ''
        });
    }

    render() {
        const { navigation, LightningAddressStore, SettingsStore } = this.props;
        const {
            newLightningAddress,
            enableZaplockerVerification,
            nostrPrivateKey,
            nostrPublicKey,
            nostrNpub,
            selectedIndex
        } = this.state;
        const {
            create,
            status,
            lightningAddress,
            availableHashes,
            paid,
            settled,
            fees,
            error,
            error_msg,
            loading
        } = LightningAddressStore;
        const { settings, updateSettings } = SettingsStore;
        const { nostr } = settings;
        const { relays } = nostr;

        const InfoButton = () => (
            <View style={{ right: 15 }}>
                <Icon
                    name="info"
                    onPress={() => {
                        // TODO reset
                        // navigation.navigate('LightningAddressInfo');
                        this.props.LightningAddressStore.test_DELETE();
                    }}
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={35}
                />
            </View>
        );

        const SettingsButton = () => (
            <View>
                <Icon
                    name="settings"
                    onPress={() => {
                        navigation.navigate('LightningAddressSettings');
                    }}
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={35}
                />
            </View>
        );

        const QRButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('QR', {
                        value: lightningAddress,
                        hideText: true,
                        jumboLabel: true
                    })
                }
                style={{ marginTop: 5 }}
            >
                <Icon
                    name="qr-code"
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={30}
                />
            </TouchableOpacity>
        );

        const statusGood = availableHashes > 500;

        const openOrdersButton = () => (
            <Text
                style={{
                    fontFamily: 'Lato-Regular',
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
                    fontFamily: 'Lato-Regular',
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
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        rightComponent={
                            <Row>
                                {!loading && fees && !error && <InfoButton />}
                                {lightningAddress && <SettingsButton />}
                            </Row>
                        }
                        navigation={navigation}
                    />
                    <View style={{ flex: 1, margin: 5 }}>
                        {loading && <LoadingIndicator />}
                        {!loading && !!error_msg && (
                            <ErrorMessage message={error_msg} dismissable />
                        )}
                        {!loading && lightningAddress && (
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
                                            fontFamily: 'Lato-Regular',
                                            fontSize: 16,
                                            color: themeColor('text'),
                                            textAlign: 'center'
                                        }}
                                    >
                                        {lightningAddress}
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
                                            fontFamily: 'Lato-Regular',

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
                                            fontFamily: 'Lato-Regular',
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
                                            fontFamily: 'Lato-Regular',
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
                        {!loading && !lightningAddress && !error && (
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

                                    <View style={styles.wrapper}>
                                        <Text
                                            style={{
                                                top: 20,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.LightningAddress.enableZaplockerVerification'
                                            )}
                                        </Text>
                                        <Switch
                                            value={enableZaplockerVerification}
                                            onValueChange={() =>
                                                this.setState({
                                                    enableZaplockerVerification:
                                                        !enableZaplockerVerification
                                                })
                                            }
                                        />
                                    </View>

                                    {enableZaplockerVerification && (
                                        <>
                                            <View style={styles.wrapper}>
                                                <Text style={styles.text}>
                                                    {`${localeString(
                                                        'nostr.privkey'
                                                    )} ${localeString(
                                                        'general.or'
                                                    )} ${localeString(
                                                        'nostr.nsec'
                                                    )}`}
                                                </Text>
                                                <View
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'row'
                                                    }}
                                                >
                                                    <TextInput
                                                        value={nostrPrivateKey}
                                                        onChangeText={(
                                                            text: string
                                                        ) => {
                                                            let nostrPrivateKey: string =
                                                                    text,
                                                                nostrPublicKey,
                                                                nostrNpub;
                                                            try {
                                                                if (
                                                                    text.includes(
                                                                        'nsec'
                                                                    )
                                                                ) {
                                                                    let {
                                                                        type,
                                                                        data
                                                                    } =
                                                                        nip19.decode(
                                                                            text
                                                                        );
                                                                    if (
                                                                        type ===
                                                                            'nsec' &&
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
                                                                updateSettings({
                                                                    nostr: {
                                                                        relays,
                                                                        nostrPrivateKey
                                                                    }
                                                                });
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
                                                            fill={themeColor(
                                                                'text'
                                                            )}
                                                            width="35"
                                                            height="35"
                                                        />
                                                    </TouchableOpacity>
                                                </View>

                                                {nostrPublicKey && (
                                                    <KeyValue
                                                        keyValue={localeString(
                                                            'nostr.pubkey'
                                                        )}
                                                        value={nostrPublicKey}
                                                    />
                                                )}

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
                                                    navigation.navigate('Nostr')
                                                }
                                            >
                                                <ListItem.Content>
                                                    <ListItem.Title
                                                        style={{
                                                            color: themeColor(
                                                                'text'
                                                            ),
                                                            fontFamily:
                                                                'Lato-Regular'
                                                        }}
                                                    >
                                                        {`${localeString(
                                                            'views.Settings.Nostr.relays'
                                                        )} (${
                                                            relays?.length || 0
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
                                    )}
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
                                                    enableZaplockerVerification
                                                        ? nostrPublicKey
                                                        : undefined,
                                                    enableZaplockerVerification
                                                        ? relays
                                                        : undefined
                                                ).finally(() => status())
                                            }
                                            disabled={
                                                enableZaplockerVerification &&
                                                (!nostrPublicKey ||
                                                    !nostrNpub ||
                                                    !relays ||
                                                    relays.length === 0)
                                            }
                                        />
                                    </View>
                                </View>
                            </>
                        )}
                        {lightningAddress && (
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
        fontFamily: 'Lato-Regular',
        color: themeColor('text')
    },
    wrapper: {
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 15,
        paddingRight: 15
    }
});
