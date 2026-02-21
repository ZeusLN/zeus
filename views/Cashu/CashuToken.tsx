import * as React from 'react';
import { Alert, StyleSheet, ScrollView, View, Share } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ButtonGroup } from '@rneui/themed';

import CashuStore from '../../stores/CashuStore';
import ChannelsStore from '../../stores/ChannelsStore';
import { activityStore, settingsStore } from '../../stores/Stores';

import Amount from '../../components/Amount';
import AnimatedQRDisplay from '../../components/AnimatedQRDisplay';
import Button from '../../components/Button';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import {
    SuccessMessage,
    WarningMessage,
    ErrorMessage
} from '../../components/SuccessErrorMessage';
import Text from '../../components/Text';

import CashuToken from '../../models/CashuToken';

import { ZEUS_ECASH_GIFT_URL } from '../../utils/AddressUtils';
import BackendUtils from '../../utils/BackendUtils';
import { getButtonGroupStyles } from '../../utils/buttonGroupStyles';
import DateTimeUtils from '../../utils/DateTimeUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface CashuTokenProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    ChannelsStore: ChannelsStore;
    route: Route<
        'CashuToken',
        { token?: string; decoded: CashuToken; offlineSpent?: boolean }
    >;
}

interface CashuTokenState {
    updatedToken?: CashuToken;
    success: boolean;
    errorMessage: string;
    warningMessage: string;
    infoIndex: number;
    isTokenTooLarge: boolean;
}

const MAX_TOKEN_LENGTH = 1000;

@inject('CashuStore', 'ChannelsStore')
@observer
export default class CashuTokenView extends React.Component<
    CashuTokenProps,
    CashuTokenState
> {
    state = {
        updatedToken: undefined,
        success: false,
        errorMessage: '',
        warningMessage: '',
        infoIndex: 0,
        isTokenTooLarge: false
    };

    async componentDidMount() {
        const { route, CashuStore } = this.props;
        const {
            checkTokenSpent,
            markTokenSpent,
            clearToken,
            initializeWallet,
            cashuWallets
        } = CashuStore!!;

        clearToken();
        const decoded = route.params?.decoded;
        const token = route.params?.token || decoded?.encodedToken;
        const { spent, mint } = decoded;

        if (token) {
            this.setState({ isTokenTooLarge: token.length > MAX_TOKEN_LENGTH });
        }

        if (!spent) {
            if (__DEV__) {
                console.log('token not spent last time checked, checking...', {
                    decoded
                });
            }

            if (!cashuWallets[mint]) {
                await initializeWallet(mint);
            }
            // Set up a periodic check every 5 seconds
            const checkInterval = setInterval(async () => {
                const isSpent = await checkTokenSpent(decoded);

                if (isSpent) {
                    const updatedToken = await markTokenSpent(decoded);
                    this.setState({
                        updatedToken
                    });
                    clearInterval(checkInterval);
                    activityStore.getActivityAndFilter(
                        settingsStore.settings.locale
                    );
                }
            }, 5000);
        }
    }

    shareGiftLink = async (token: string) => {
        const giftUrl = `${ZEUS_ECASH_GIFT_URL}${token}`;
        try {
            await Share.share({
                message: giftUrl
            });
        } catch (error) {
            console.log('Error sharing gift link:', error);
        }
    };

    render() {
        const { navigation, route, CashuStore, ChannelsStore } = this.props;
        const {
            success,
            errorMessage,
            warningMessage,
            updatedToken,
            infoIndex,
            isTokenTooLarge
        } = this.state;
        const {
            mintUrls,
            addMint,
            claimToken,
            loading,
            errorAddingMint,
            error_msg: storeErrorMsg
        } = CashuStore!!;
        const decoded = updatedToken || route.params?.decoded;
        const {
            memo,
            mint,
            unit,
            proofs,
            getAmount,
            isSupported,
            received,
            sent,
            spent,
            pendingClaim,
            encodedToken,
            getDisplayTime
        } = decoded;
        const token: string = route.params?.token || encodedToken || '';

        const haveMint = mintUrls.includes(mint);
        const hasOpenChannels = ChannelsStore?.channels?.length > 0;
        const enableCashu = settingsStore.settings.ecash?.enableCashu;

        const groupStyles = getButtonGroupStyles();

        const qrButton = () => (
            <Text
                style={{
                    ...styles.text,
                    color:
                        infoIndex === 1
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('views.PSBT.qrs')}
            </Text>
        );
        const infoButton = () => (
            <Text
                style={{
                    ...styles.text,
                    color:
                        infoIndex === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('views.Cashu.CashuToken.info')}
            </Text>
        );

        const infoButtons: any = [
            { element: infoButton },
            { element: qrButton }
        ];

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text:
                            spent || route.params?.offlineSpent
                                ? localeString('cashu.spentToken')
                                : pendingClaim
                                ? localeString('cashu.offlinePending.title')
                                : received
                                ? localeString('cashu.receivedToken')
                                : sent
                                ? localeString('cashu.unspentToken')
                                : localeString('cashu.token'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        loading ? (
                            <View>
                                <LoadingIndicator size={30} />
                            </View>
                        ) : (
                            <></>
                        )
                    }
                    navigation={navigation}
                />
                <ScrollView keyboardShouldPersistTaps="handled">
                    {success && !warningMessage && (
                        <SuccessMessage
                            message={localeString(
                                'views.Cashu.CashuToken.success'
                            )}
                        />
                    )}

                    {warningMessage && (
                        <WarningMessage message={warningMessage} />
                    )}

                    {(errorMessage || storeErrorMsg) && (
                        <ErrorMessage message={errorMessage || storeErrorMsg} />
                    )}

                    {errorAddingMint && (
                        <ErrorMessage
                            message={localeString('cashu.errorAddingMint')}
                        />
                    )}

                    {!isSupported && (
                        <ErrorMessage
                            message={`${localeString(
                                'views.Cashu.CashuToken.notSupported'
                            )}: ${unit}`}
                        />
                    )}

                    {(spent || route.params?.offlineSpent) && (
                        <ErrorMessage
                            message={localeString(
                                'cashu.offlineSpent.tokenSpent'
                            )}
                        />
                    )}

                    {isSupported && (
                        <View style={styles.center}>
                            <Amount
                                sats={getAmount}
                                sensitive
                                jumboText
                                toggleable
                                credit={received && !pendingClaim}
                                debit={sent && spent && !pendingClaim}
                            />
                        </View>
                    )}

                    <ButtonGroup
                        onPress={(infoIndex: number) => {
                            this.setState({ infoIndex });
                        }}
                        selectedIndex={infoIndex}
                        buttons={infoButtons}
                        selectedButtonStyle={groupStyles.selectedButtonStyle}
                        containerStyle={groupStyles.containerStyle}
                        innerBorderStyle={groupStyles.innerBorderStyle}
                    />

                    {infoIndex === 0 && (
                        <View style={styles.content}>
                            {mint && (
                                <KeyValue
                                    keyValue={localeString('cashu.mintUrl')}
                                    value={mint}
                                    sensitive
                                />
                            )}

                            {memo && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Invoice.memo'
                                    )}
                                    value={memo}
                                    sensitive
                                />
                            )}

                            {proofs && proofs.length > 0 && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Cashu.CashuToken.proofCount'
                                    )}
                                    value={proofs.length}
                                    sensitive
                                />
                            )}

                            {getDisplayTime && getDisplayTime !== '' && (
                                <KeyValue
                                    keyValue={localeString(
                                        sent
                                            ? 'views.Invoice.creationDate'
                                            : 'views.Invoice.settleDate'
                                    )}
                                    value={getDisplayTime}
                                    sensitive
                                />
                            )}

                            {decoded?.getLockPubkey && (
                                <KeyValue
                                    keyValue={localeString('cashu.lockTo')}
                                    value={
                                        decoded.getContactName ||
                                        decoded.getLockPubkey
                                    }
                                    sensitive
                                />
                            )}

                            {decoded?.getLockPubkey && (
                                <KeyValue
                                    keyValue={localeString('cashu.locktime')}
                                    value={
                                        decoded.getLocktime
                                            ? DateTimeUtils.listFormattedDate(
                                                  decoded.getLocktime
                                              )
                                            : localeString(
                                                  'cashu.duration.forever'
                                              )
                                    }
                                    sensitive
                                />
                            )}
                        </View>
                    )}

                    {infoIndex === 1 && (
                        <AnimatedQRDisplay
                            data={token}
                            encoderType="generic"
                            fileType="U"
                            valuePrefix="cashu:"
                            copyValue={`cashu:${token}`}
                            hideSingleFrame={isTokenTooLarge}
                            onShareGiftLink={() => this.shareGiftLink(token)}
                        />
                    )}
                </ScrollView>
                {infoIndex === 0 &&
                    (success || warningMessage) &&
                    !received &&
                    !pendingClaim && (
                        <View style={{ bottom: 15 }}>
                            <Button
                                title={localeString(
                                    'views.SendingLightning.goToWallet'
                                )}
                                icon={{
                                    name: 'list',
                                    size: 25,
                                    color: themeColor('background')
                                }}
                                onPress={() => {
                                    navigation.popTo('Wallet');
                                }}
                                containerStyle={{ marginTop: 15 }}
                            />
                        </View>
                    )}
                {infoIndex === 0 &&
                    !success &&
                    !warningMessage &&
                    !received &&
                    !pendingClaim &&
                    (!sent || (sent && !spent)) && (
                        <View style={{ bottom: 15 }}>
                            {BackendUtils.supportsCashuWallet() && (
                                <>
                                    {!haveMint && (
                                        <Button
                                            title={localeString(
                                                enableCashu
                                                    ? 'views.Cashu.AddMint.title'
                                                    : 'views.Cashu.AddMint.enableAndAdd'
                                            )}
                                            onPress={async () => {
                                                if (!enableCashu) {
                                                    await settingsStore.updateSettings(
                                                        {
                                                            ecash: {
                                                                ...(settingsStore
                                                                    .settings
                                                                    .ecash ||
                                                                    {}),
                                                                enableCashu:
                                                                    true
                                                            }
                                                        }
                                                    );
                                                    await CashuStore.initializeWallets();
                                                }
                                                await addMint(mint);
                                            }}
                                            containerStyle={{ marginTop: 15 }}
                                            disabled={!isSupported || loading}
                                            tertiary
                                        />
                                    )}
                                    <Button
                                        title={localeString('general.receive')}
                                        onPress={async () => {
                                            this.setState({
                                                errorMessage: '',
                                                warningMessage: ''
                                            });

                                            // Use encodedToken from decoded (clean, no cashu: prefix)
                                            const {
                                                success,
                                                errorMessage,
                                                warningMessage
                                            } = await claimToken(
                                                encodedToken!,
                                                decoded
                                            );
                                            if (errorMessage) {
                                                this.setState({
                                                    errorMessage
                                                });
                                            } else if (warningMessage) {
                                                this.setState({
                                                    success,
                                                    warningMessage
                                                });
                                            } else if (success) {
                                                this.setState({
                                                    success
                                                });
                                            }
                                        }}
                                        containerStyle={{ marginTop: 15 }}
                                        disabled={
                                            !haveMint ||
                                            errorAddingMint ||
                                            !isSupported ||
                                            loading
                                        }
                                    />
                                </>
                            )}
                            <Button
                                title={localeString(
                                    'views.Cashu.CashuToken.meltTokenSelfCustody'
                                )}
                                onPress={async () => {
                                    this.setState({
                                        errorMessage: ''
                                    });

                                    const { success, errorMessage } =
                                        await claimToken(
                                            token!!,
                                            decoded,
                                            true
                                        );
                                    if (errorMessage) {
                                        this.setState({
                                            errorMessage
                                        });
                                    } else if (success) {
                                        this.setState({
                                            success
                                        });
                                    }
                                }}
                                containerStyle={{ marginTop: 15 }}
                                disabled={
                                    !hasOpenChannels || !isSupported || loading
                                }
                                secondary
                            />
                        </View>
                    )}
                {infoIndex === 0 && pendingClaim && (
                    <View style={{ bottom: 15 }}>
                        <Button
                            title={localeString('general.delete')}
                            onPress={() => {
                                Alert.alert(
                                    localeString('cashu.deleteToken.title'),
                                    localeString('cashu.deleteToken.message'),
                                    [
                                        {
                                            text: localeString(
                                                'general.cancel'
                                            ),
                                            style: 'cancel'
                                        },
                                        {
                                            text: localeString(
                                                'general.delete'
                                            ),
                                            style: 'destructive',
                                            onPress: async () => {
                                                const isSpentToken =
                                                    CashuStore.offlineSpentTokens.some(
                                                        (t) =>
                                                            t.encodedToken ===
                                                            encodedToken
                                                    );
                                                if (isSpentToken) {
                                                    await CashuStore.removeOfflineSpentToken(
                                                        encodedToken!
                                                    );
                                                } else {
                                                    await CashuStore.removeOfflinePendingToken(
                                                        encodedToken!
                                                    );
                                                }
                                                navigation.goBack();
                                            }
                                        }
                                    ]
                                );
                            }}
                            containerStyle={{ marginTop: 15 }}
                            warning
                        />
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    }
});
