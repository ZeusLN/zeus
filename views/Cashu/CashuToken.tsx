import * as React from 'react';
import { Alert, StyleSheet, ScrollView, View, Share } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ButtonGroup } from '@rneui/themed';

import CashuStore, { TokenSwapQuote } from '../../stores/CashuStore';
import ChannelsStore from '../../stores/ChannelsStore';
import ModalStore from '../../stores/ModalStore';
import { activityStore, settingsStore } from '../../stores/Stores';

import Amount from '../../components/Amount';
import AnimatedQRDisplay from '../../components/AnimatedQRDisplay';
import Button from '../../components/Button';
import EcashMintPicker from '../../components/EcashMintPicker';
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
import UrlUtils from '../../utils/UrlUtils';

interface CashuTokenProps {
    navigation: NativeStackNavigationProp<any, any>;
    CashuStore: CashuStore;
    ChannelsStore: ChannelsStore;
    ModalStore?: ModalStore;
    route: Route<
        'CashuToken',
        {
            token?: string;
            decoded: CashuToken;
            startOnQrTab?: boolean;
            offlineSpent?: boolean;
            // Set by the Mints picker when choosing a swap destination
            pickedMintUrl?: string;
        }
    >;
}

interface CashuTokenState {
    updatedToken?: CashuToken;
    success: boolean;
    errorMessage: string;
    warningMessage: string;
    infoIndex: number;
    isTokenTooLarge: boolean;
    swapMode: boolean;
    destinationMintUrl: string;
    swapQuote: TokenSwapQuote | null;
    // The token's mint was contacted for a quote and may need discarding
    swapQuoted: boolean;
    swapStarted: boolean;
    successMessage: string;
    leftoverSats?: number;
}

const MAX_TOKEN_LENGTH = 1000;

@inject('CashuStore', 'ChannelsStore', 'ModalStore')
@observer
export default class CashuTokenView extends React.Component<
    CashuTokenProps,
    CashuTokenState
> {
    checkInterval: ReturnType<typeof setInterval> | null = null;

    state: CashuTokenState = {
        updatedToken: undefined,
        success: false,
        errorMessage: '',
        warningMessage: '',
        infoIndex: 0,
        isTokenTooLarge: false,
        swapMode: false,
        destinationMintUrl: '',
        swapQuote: null,
        swapQuoted: false,
        swapStarted: false,
        successMessage: '',
        leftoverSats: undefined
    };

    private stopCheckingInterval = () => {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    };

    async componentDidMount() {
        const { route, CashuStore } = this.props;
        const {
            checkTokenSpent,
            markTokenSpent,
            clearToken,
            initializeWallet,
            cashuWallets,
            isKnownMint
        } = CashuStore!!;

        clearToken();
        const decoded = route.params?.decoded;
        const token = route.params?.token || decoded?.encodedToken;
        const { spent, mint } = decoded;
        const offlineSpent = route.params?.offlineSpent;

        if (token) {
            this.setState({ isTokenTooLarge: token.length > MAX_TOKEN_LENGTH });
        }

        if (route.params?.startOnQrTab) {
            this.setState({ infoIndex: 1 });
        }

        if (spent || offlineSpent) {
            this.setState({
                errorMessage: localeString('cashu.offlineSpent.tokenSpent')
            });
            return;
        }

        // Only contact the mint for an unspent token when the user already
        // trusts it (it is in their added mints). A token is a bearer
        // instrument whose mint field is attacker-chosen, so merely viewing a
        // scanned/pasted token from an unknown mint must not add that mint,
        // initialize a wallet for it, or poll it for proof state: doing so
        // would leak the viewer's IP/timing and the receipt-correlating proof
        // Y values to an attacker-controlled server without consent. Contact
        // is deferred to the explicit Add Mint / Receive actions. This mirrors
        // the cashu.me wallet, which decodes tokens offline and only reaches an
        // untrusted mint on an explicit user action.
        const haveMint = isKnownMint(mint);

        if (!spent && haveMint) {
            if (__DEV__) {
                console.log('token not spent last time checked, checking...', {
                    decoded
                });
            }

            if (!cashuWallets[mint]) {
                await initializeWallet(mint);
            }
            // Set up a periodic check every 5 seconds
            this.checkInterval = setInterval(async () => {
                const isSpent = await checkTokenSpent(decoded);

                if (isSpent) {
                    const updatedToken = await markTokenSpent(decoded);
                    this.setState({
                        updatedToken
                    });
                    this.stopCheckingInterval();
                    activityStore.getActivityAndFilter(
                        settingsStore.settings.locale
                    );
                }
            }, 5000);
        }
    }

    componentDidUpdate(prevProps: CashuTokenProps) {
        const pickedMintUrl = this.props.route.params?.pickedMintUrl;
        if (
            pickedMintUrl &&
            pickedMintUrl !== prevProps.route.params?.pickedMintUrl
        ) {
            this.setState({
                destinationMintUrl: pickedMintUrl,
                swapQuote: null,
                errorMessage: ''
            });
        }
    }

    componentWillUnmount() {
        this.stopCheckingInterval();
        this.discardQuotedMint();
    }

    // A quote registers the token's mint in CDK. If the user backs out
    // before swapping, remove it so it cannot slip into their mint list.
    private discardQuotedMint = () => {
        const { swapQuoted, swapStarted } = this.state;
        if (swapQuoted && !swapStarted) {
            this.props.CashuStore.discardTransitMint(
                this.props.route.params.decoded.mint
            );
        }
    };

    private defaultDestinationMint = (): string => {
        const { selectedMintUrl, mintUrls, isKnownMint } =
            this.props.CashuStore;
        return selectedMintUrl && isKnownMint(selectedMintUrl)
            ? selectedMintUrl
            : mintUrls[0] || '';
    };

    private getSwapQuote = async () => {
        const { CashuStore, route } = this.props;
        const { destinationMintUrl } = this.state;
        this.setState({ errorMessage: '', swapQuoted: true });
        try {
            const swapQuote = await CashuStore.quoteTokenSwap(
                route.params.decoded,
                destinationMintUrl
            );
            this.setState({ swapQuote });
        } catch (e: any) {
            this.setState({
                errorMessage:
                    e?.message || localeString('stores.CashuStore.claimError')
            });
        }
    };

    private confirmSwap = async (encodedToken: string) => {
        const { CashuStore, route } = this.props;
        const { destinationMintUrl, swapQuote } = this.state;
        if (!swapQuote) return;
        this.setState({
            errorMessage: '',
            warningMessage: '',
            swapStarted: true
        });

        const { success, errorMessage, warningMessage, leftoverSats } =
            await CashuStore.swapTokenToMint(
                encodedToken,
                route.params.decoded,
                destinationMintUrl,
                swapQuote.feeReserve
            );

        if (!success) {
            // Nothing was redeemed, so the token's mint can still be
            // discarded when the user leaves
            this.setState({
                errorMessage,
                swapStarted: false,
                swapQuote: null
            });
            return;
        }
        this.setState({
            success,
            warningMessage: warningMessage || '',
            leftoverSats,
            successMessage: localeString('views.Cashu.CashuToken.swapSuccess', {
                destMintName: CashuStore.getMintName(destinationMintUrl)
            })
        });
    };

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

    handlePendingPress = () => {
        this.props.ModalStore!.toggleInfoModal({
            title: localeString('views.Wallet.pendingBalanceIcon.title'),
            text: localeString(
                'views.Wallet.pendingBalanceIcon.explainerCashu'
            ),
            buttons: [
                {
                    title: localeString('general.learnMore'),
                    callback: () =>
                        UrlUtils.goToUrl(
                            'https://docs.zeusln.app/for-users/using-zeus/pending-balances'
                        )
                }
            ]
        });
    };

    render() {
        const { navigation, route, CashuStore, ChannelsStore } = this.props;
        const {
            success,
            errorMessage,
            warningMessage,
            updatedToken,
            infoIndex,
            isTokenTooLarge,
            swapMode,
            destinationMintUrl,
            swapQuote,
            successMessage,
            leftoverSats
        } = this.state;
        const {
            mintUrls,
            addMint,
            claimToken,
            loading,
            errorAddingMint,
            error_msg: storeErrorMsg,
            isKnownMint,
            isOffline,
            getMintName
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
        const isSpent = spent || route.params?.offlineSpent;

        const haveMint = isKnownMint(mint);
        const hasOpenChannels = ChannelsStore?.channels?.length > 0;
        const enableCashu = settingsStore.settings.ecash?.enableCashu;
        const canSwap =
            !haveMint &&
            !!enableCashu &&
            mintUrls.length > 0 &&
            isSupported &&
            !isOffline &&
            BackendUtils.supportsCashuWallet();
        const showSwapPanel = swapMode && !success && !warningMessage;

        const addMintButton = (
            <Button
                title={localeString(
                    enableCashu
                        ? 'views.Cashu.AddMint.title'
                        : 'views.Cashu.AddMint.enableAndAdd'
                )}
                onPress={async () => {
                    CashuStore.setLoading(true);
                    try {
                        if (!enableCashu) {
                            await settingsStore.updateSettings({
                                ecash: {
                                    ...(settingsStore.settings.ecash || {}),
                                    enableCashu: true
                                }
                            });
                            await CashuStore.initializeWallets();
                        }
                        await addMint(mint);
                    } catch (e) {
                        console.error('Error enabling Cashu / adding mint:', e);
                        this.setState({
                            errorMessage: localeString(
                                'stores.CashuStore.errorAddingMint'
                            )
                        });
                        CashuStore.setLoading(false);
                    }
                }}
                containerStyle={{ marginTop: 15 }}
                disabled={!isSupported || loading}
                tertiary
            />
        );

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
                        text: isSpent
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
                            message={
                                successMessage ||
                                localeString('views.Cashu.CashuToken.success')
                            }
                        />
                    )}

                    {success && !!leftoverSats && !haveMint && (
                        <WarningMessage
                            message={localeString(
                                'views.Cashu.CashuToken.swapLeftover',
                                {
                                    amount: leftoverSats,
                                    mintName: getMintName(mint)
                                }
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

                    {isSupported && (
                        <View style={styles.center}>
                            <Amount
                                sats={getAmount}
                                sensitive
                                jumboText
                                toggleable
                                credit={received && !pendingClaim && !isSpent}
                                pending={pendingClaim && !isSpent}
                                debit={sent && isSpent && !pendingClaim}
                                onPendingPress={this.handlePendingPress}
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
                                    showCopyIcon
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
                                    showCopyIcon
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

                            {showSwapPanel && (
                                <View style={styles.swapPanel}>
                                    <Text
                                        style={{
                                            ...styles.text,
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {localeString(
                                            'views.Cashu.CashuToken.swapExplainer',
                                            { mintName: getMintName(mint) }
                                        )}
                                    </Text>
                                    <Text
                                        style={{
                                            ...styles.text,
                                            ...styles.swapLabel,
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {localeString(
                                            'views.Cashu.CashuToken.swapDestination'
                                        )}
                                    </Text>
                                    <EcashMintPicker
                                        navigation={navigation}
                                        overrideMintUrl={destinationMintUrl}
                                        disableRandom
                                        disabled={loading}
                                        onPress={() => {
                                            if (loading) return;
                                            navigation.navigate('Mints', {
                                                pickFor: 'CashuToken',
                                                pickedMintUrl:
                                                    destinationMintUrl
                                            });
                                        }}
                                    />
                                    {swapQuote && (
                                        <Text
                                            style={{
                                                ...styles.text,
                                                ...styles.swapLabel,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Cashu.CashuToken.swapQuoteSummary',
                                                {
                                                    amount: swapQuote.estimatedReceive,
                                                    fee: swapQuote.feeReserve,
                                                    destMintName:
                                                        getMintName(
                                                            destinationMintUrl
                                                        )
                                                }
                                            )}
                                        </Text>
                                    )}
                                </View>
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
                            {!!leftoverSats && !haveMint && addMintButton}
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
                            {showSwapPanel ? (
                                <>
                                    <Button
                                        title={localeString(
                                            swapQuote
                                                ? 'general.confirm'
                                                : 'views.Cashu.CashuToken.swapGetQuote'
                                        )}
                                        onPress={() =>
                                            swapQuote
                                                ? this.confirmSwap(
                                                      encodedToken!
                                                  )
                                                : this.getSwapQuote()
                                        }
                                        containerStyle={{ marginTop: 15 }}
                                        disabled={
                                            loading || !destinationMintUrl
                                        }
                                    />
                                    <Button
                                        title={localeString('general.cancel')}
                                        onPress={() => {
                                            this.discardQuotedMint();
                                            this.setState({
                                                swapMode: false,
                                                swapQuote: null,
                                                swapQuoted: false,
                                                errorMessage: ''
                                            });
                                        }}
                                        containerStyle={{ marginTop: 15 }}
                                        disabled={loading}
                                        secondary
                                    />
                                </>
                            ) : (
                                <>
                                    {BackendUtils.supportsCashuWallet() && (
                                        <>
                                            {!haveMint && addMintButton}
                                            <Button
                                                title={localeString(
                                                    'general.receive'
                                                )}
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
                                                containerStyle={{
                                                    marginTop: 15
                                                }}
                                                disabled={
                                                    !haveMint ||
                                                    errorAddingMint ||
                                                    !isSupported ||
                                                    loading
                                                }
                                            />
                                        </>
                                    )}
                                    {canSwap && (
                                        <Button
                                            title={localeString(
                                                'views.Cashu.CashuToken.receiveToAnotherMint'
                                            )}
                                            onPress={() =>
                                                this.setState({
                                                    swapMode: true,
                                                    destinationMintUrl:
                                                        destinationMintUrl ||
                                                        this.defaultDestinationMint(),
                                                    errorMessage: ''
                                                })
                                            }
                                            containerStyle={{ marginTop: 15 }}
                                            disabled={loading}
                                            secondary
                                        />
                                    )}
                                    <Button
                                        title={localeString(
                                            BackendUtils.supportsChannelManagement()
                                                ? 'views.Cashu.CashuToken.meltTokenSelfCustody'
                                                : 'general.receive'
                                        )}
                                        onPress={async () => {
                                            this.setState({
                                                errorMessage: '',
                                                warningMessage: ''
                                            });

                                            const {
                                                success,
                                                errorMessage,
                                                warningMessage
                                            } = await claimToken(
                                                encodedToken!,
                                                decoded,
                                                true
                                            );

                                            if (warningMessage) {
                                                this.setState({
                                                    success,
                                                    warningMessage
                                                });
                                            } else if (success) {
                                                this.setState({
                                                    success
                                                });
                                            } else {
                                                this.setState({
                                                    errorMessage:
                                                        errorMessage ||
                                                        localeString(
                                                            'stores.CashuStore.claimError'
                                                        )
                                                });
                                            }
                                        }}
                                        containerStyle={{ marginTop: 15 }}
                                        disabled={
                                            (BackendUtils.supportsChannelManagement() &&
                                                !hasOpenChannels) ||
                                            !isSupported ||
                                            loading
                                        }
                                        secondary
                                    />
                                </>
                            )}
                        </View>
                    )}
                {infoIndex === 0 &&
                    (pendingClaim || route.params?.offlineSpent) && (
                        <View style={{ bottom: 15 }}>
                            <Button
                                title={localeString('general.delete')}
                                onPress={() => {
                                    Alert.alert(
                                        localeString('cashu.deleteToken.title'),
                                        localeString(
                                            'cashu.deleteToken.message'
                                        ),
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
    },
    swapPanel: {
        paddingTop: 15
    },
    swapLabel: {
        paddingTop: 10,
        paddingBottom: 5
    }
});
