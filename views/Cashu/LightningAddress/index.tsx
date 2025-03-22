import * as React from 'react';
import {
    Dimensions,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import LightningAddressPayment from './LightningAddressPayment';

import Button from '../../../components/Button';
import DropdownSetting from '../../../components/DropdownSetting';
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
import CashuStore from '../../../stores/CashuStore';
import CashuLightningAddressStore from '../../../stores/CashuLightningAddressStore';
import { DEFAULT_LSPS1_PUBKEY_MAINNET } from '../../../stores/SettingsStore';
import UnitsStore from '../../../stores/UnitsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import QR from '../../../assets/images/SVG/QR.svg';
import Gear from '../../../assets/images/SVG/Gear.svg';

interface CashuLightningAddressProps {
    navigation: StackNavigationProp<any, any>;
    ChannelsStore: ChannelsStore;
    CashuStore: CashuStore;
    CashuLightningAddressStore: CashuLightningAddressStore;
    UnitsStore: UnitsStore;
    route: Route<
        'CashuLightningAddress',
        { skipStatus: boolean; nostrPrivateKey: string }
    >;
}

interface MintItem {
    key: string;
    value: string;
}

interface CashuLightningAddressState {
    newLightningAddress: string;
    mintList: Array<MintItem>;
    mintUrl: string;
    hasZeusLspChannel: boolean;
}

@inject(
    'CashuStore',
    'CashuLightningAddressStore',
    'ChannelsStore',
    'UnitsStore'
)
@observer
export default class CashuLightningAddress extends React.Component<
    CashuLightningAddressProps,
    CashuLightningAddressState
> {
    isInitialFocus = true;

    state = {
        newLightningAddress: '',
        mintList: [],
        mintUrl: '',
        hasZeusLspChannel: false
    };

    async componentDidMount() {
        const { CashuLightningAddressStore, ChannelsStore, navigation, route } =
            this.props;
        const { status } = CashuLightningAddressStore;

        const skipStatus = route.params?.skipStatus;
        if (!skipStatus) status();

        this.loadMints();

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

    loadMints = () => {
        const { CashuStore } = this.props;
        const { selectedMintUrl, mintUrls, cashuWallets } = CashuStore;

        const mintList: Array<MintItem> = mintUrls
            ? mintUrls.map((mintUrl) => {
                  return {
                      key: cashuWallets[mintUrl].mintInfo.name,
                      value: mintUrl
                  };
              })
            : [];

        this.setState({
            mintList,
            mintUrl: selectedMintUrl
        });
    };

    handleFocus = () => {
        if (this.isInitialFocus) {
            this.isInitialFocus = false;
        } else {
            this.props.CashuLightningAddressStore.status();
            this.loadMints();
        }
    };

    render() {
        const { navigation, CashuLightningAddressStore } = this.props;
        const {
            newLightningAddress,
            mintUrl,
            mintList
            // hasZeusLspChannel
        } = this.state;
        const {
            create,
            status,
            redeemAllOpenPayments,
            cashuLightningAddressHandle,
            cashuLightningAddressDomain,
            paid,
            error_msg,
            loading,
            redeeming,
            redeemingAll
        } = CashuLightningAddressStore;

        const { fontScale } = Dimensions.get('window');

        const mintsNotConfigured = mintList.length === 0;

        const InfoButton = () => (
            <View style={{ right: 15 }}>
                <Icon
                    name="info"
                    onPress={() => {
                        navigation.navigate('CashuLightningAddressInfo');
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
                    navigation.navigate('CashuLightningAddressSettings');
                }}
            >
                <Gear
                    style={{ alignSelf: 'center' }}
                    fill={themeColor('text')}
                />
            </TouchableOpacity>
        );

        const QRButton = () => {
            const address = `${cashuLightningAddressHandle}@${cashuLightningAddressDomain}`;
            return (
                <TouchableOpacity
                    onPress={() =>
                        navigation.navigate('QR', {
                            value: `lightning:${address}`,
                            label: address,
                            hideText: true,
                            jumboLabel: true,
                            logo: themeColor('invertQrIcons')
                                ? require('../../../assets/images/pay-z-white.png')
                                : require('../../../assets/images/pay-z-black.png')
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

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('cashu.lightningAddress'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        rightComponent={
                            !loading && !redeeming && !redeemingAll ? (
                                <Row>
                                    <InfoButton />
                                    {cashuLightningAddressHandle && (
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
                            !redeemingAll &&
                            !redeeming &&
                            cashuLightningAddressHandle && (
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
                                            {`${cashuLightningAddressHandle}@${cashuLightningAddressDomain}`}
                                        </Text>
                                    </Row>
                                    <QRButton />
                                </View>
                            )}
                        {!loading &&
                            !redeeming &&
                            !redeemingAll &&
                            !cashuLightningAddressHandle && (
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
                                                    locked={mintsNotConfigured}
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
                                                        @zeusnuts.com
                                                    </Text>
                                                </Row>
                                            </View>
                                            {mintsNotConfigured ? (
                                                <View style={{ marginTop: 20 }}>
                                                    <Button
                                                        title="No mints found. Tap to configure"
                                                        warning
                                                        onPress={() =>
                                                            navigation.navigate(
                                                                'Mints'
                                                            )
                                                        }
                                                    />
                                                </View>
                                            ) : (
                                                <DropdownSetting
                                                    title={localeString(
                                                        'cashu.mint'
                                                    )}
                                                    selectedValue={
                                                        this.props.CashuStore
                                                            ?.cashuWallets[
                                                            mintUrl
                                                        ]?.mintInfo?.name || ''
                                                    }
                                                    values={mintList}
                                                    onValueChange={(
                                                        value: string
                                                    ) => {
                                                        this.setState({
                                                            mintUrl: value
                                                        });
                                                    }}
                                                />
                                            )}
                                        </View>
                                    </View>
                                    <View style={{ bottom: 15, margin: 10 }}>
                                        <Button
                                            title={localeString(
                                                'views.Settings.LightningAddress.create'
                                            )}
                                            onPress={() =>
                                                create(
                                                    newLightningAddress,
                                                    mintUrl
                                                ).then(() => status())
                                            }
                                            disabled={mintsNotConfigured}
                                        />
                                    </View>
                                </>
                            )}
                        {cashuLightningAddressHandle && (
                            <>
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
                                                return (
                                                    <LightningAddressPayment
                                                        index={index}
                                                        item={item}
                                                        navigation={navigation}
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
        fontSize: 20,
        marginBottom: 10
    },
    wrapper: {
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 15,
        paddingRight: 15
    }
});
