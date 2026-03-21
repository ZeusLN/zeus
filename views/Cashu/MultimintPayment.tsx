import * as React from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon, ListItem } from '@rneui/themed';

import Amount from '../../components/Amount';
import Button from '../../components/Button';
import Header from '../../components/Header';
import MintAvatar from '../../components/MintAvatar';
import PaymentDetailsSheet from '../../components/PaymentDetailsSheet';
import PaymentSuccessView from '../../components/PaymentSuccessView';
import Screen from '../../components/Screen';
import { sendingStyles } from '../../components/sendingStyles';

import CashuStore from '../../stores/CashuStore';

import {
    MintPaymentStatus,
    MintProgressInfo,
    MultinutPaymentStep
} from '../../utils/CashuUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import ErrorIcon from '../../assets/images/SVG/ErrorIcon.svg';
import Wordmark from '../../assets/images/SVG/wordmark-black.svg';

interface MultimintPaymentProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<'MultimintPayment', { paymentAmount?: string }>;
    CashuStore?: CashuStore;
}

interface MultimintPaymentState {
    mints: MintProgressInfo[];
    totalSelectedBalance: number;
    step: MultinutPaymentStep;
    isProcessing: boolean;
    error?: string;
    showPaymentDetails: boolean;
}

@inject('CashuStore')
@observer
export default class MultimintPayment extends React.Component<
    MultimintPaymentProps,
    MultimintPaymentState
> {
    constructor(props: MultimintPaymentProps) {
        super(props);

        const { CashuStore, route } = props;
        const selectedMintUrls = CashuStore?.multiMintSelectedUrls || [];
        const selectedMintSet = new Set(selectedMintUrls);
        const availableMints = CashuStore?.getMultimintInfo() || [];

        const selectedMints =
            selectedMintUrls.length > 0
                ? availableMints.filter((mint) =>
                      selectedMintSet.has(mint.mintUrl)
                  )
                : availableMints;
        const effectiveMints =
            selectedMints.length > 0 ? selectedMints : availableMints;

        const totalSelectedBalance = effectiveMints.reduce(
            (sum, mint) => sum + Number(mint.balance || 0),
            0
        );

        const requestAmount =
            CashuStore?.payReq?.getRequestAmount ||
            Number(route.params?.paymentAmount || 0);
        const feeEstimate = Number(CashuStore?.feeEstimate) || 0;
        const totalNeeded = requestAmount + feeEstimate;

        const hasNoMintsSelected = effectiveMints.length === 0;
        const hasInsufficientBalance =
            totalNeeded > totalSelectedBalance && totalSelectedBalance > 0;

        this.state = {
            mints: effectiveMints,
            totalSelectedBalance,
            step:
                hasNoMintsSelected || hasInsufficientBalance
                    ? MultinutPaymentStep.FAILED
                    : MultinutPaymentStep.PROCESSING,
            isProcessing: false,
            error: hasNoMintsSelected
                ? localeString('views.Cashu.MultimintPayment.noMintsSelected')
                : hasInsufficientBalance
                ? localeString('stores.CashuStore.notEnoughFunds')
                : undefined,
            showPaymentDetails: false
        };
    }

    componentDidMount(): void {
        if (this.state.step !== MultinutPaymentStep.FAILED) {
            this.executePayment();
        }
    }

    onProgressUpdate = (progressInfo: {
        step: MultinutPaymentStep;
        mints: MintProgressInfo[];
        totalSelectedBalance: number;
        isProcessing: boolean;
    }) => {
        this.setState((prev) => ({
            mints: prev.mints.map((mint) => {
                const updated = progressInfo.mints.find(
                    (item) => item.mintUrl === mint.mintUrl
                );
                return updated ? { ...mint, ...updated } : mint;
            }),
            totalSelectedBalance:
                progressInfo.totalSelectedBalance ?? prev.totalSelectedBalance,
            isProcessing: progressInfo.isProcessing ?? prev.isProcessing,
            step: progressInfo.step || prev.step,
            error:
                progressInfo.step === MultinutPaymentStep.FAILED
                    ? prev.error
                    : undefined
        }));
    };

    executePayment = async () => {
        const { CashuStore, route } = this.props;

        try {
            this.setState((prev) => ({
                step: MultinutPaymentStep.PROCESSING,
                isProcessing: true,
                error: undefined,
                mints: prev.mints.map((mint) => ({
                    ...mint,
                    status: MintPaymentStatus.IDLE,
                    error: undefined
                }))
            }));

            const payment = await CashuStore!!.payLnInvoiceFromEcash({
                amount: route.params?.paymentAmount,
                onProgress: this.onProgressUpdate
            });

            if (!payment || CashuStore!!.paymentError) {
                this.setState({
                    step: MultinutPaymentStep.FAILED,
                    isProcessing: false,
                    error:
                        CashuStore!!.paymentErrorMsg ||
                        localeString('stores.CashuStore.errorPayingInvoice')
                });
                return;
            }

            this.setState({
                step: MultinutPaymentStep.COMPLETE,
                isProcessing: false,
                error: undefined
            });
        } catch (error: any) {
            this.setState({
                step: MultinutPaymentStep.FAILED,
                isProcessing: false,
                error:
                    error?.message ||
                    localeString('stores.CashuStore.errorPayingInvoice')
            });
        }
    };

    renderSeparator = () => (
        <View
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    renderMintItem = ({ item }: { item: MintProgressInfo }) => {
        const { isProcessing } = this.state;

        const getSubtitle = () => {
            if (item.status === MintPaymentStatus.SUCCESS) {
                return `${localeString('general.success')} | ${item.mintUrl}`;
            }
            if (item.status === MintPaymentStatus.FAILED) {
                return `${localeString('general.failed')} | ${
                    item.error || item.mintUrl
                }`;
            }
            if (item.status === MintPaymentStatus.PAYING && isProcessing) {
                return `${localeString(
                    'views.Cashu.MultimintPayment.paying'
                )} | ${item.mintUrl}`;
            }
            if (item.status === MintPaymentStatus.REQUESTING && isProcessing) {
                return `${localeString(
                    'views.Cashu.MultimintPayment.requesting'
                )} | ${item.mintUrl}`;
            }
            return item.mintUrl;
        };

        return (
            <ListItem
                containerStyle={{
                    borderBottomWidth: 0,
                    backgroundColor: 'transparent'
                }}
            >
                {(item.status === MintPaymentStatus.PAYING ||
                    item.status === MintPaymentStatus.REQUESTING) && (
                    <ActivityIndicator
                        size="small"
                        color={themeColor('highlight')}
                        style={{ marginRight: 10 }}
                    />
                )}

                {item.status === MintPaymentStatus.SUCCESS && (
                    <Icon
                        name="check-circle"
                        color={themeColor('success')}
                        size={20}
                        style={{ marginRight: 10 }}
                    />
                )}

                {item.status === MintPaymentStatus.FAILED && (
                    <Icon
                        name="error"
                        color={themeColor('error')}
                        size={20}
                        style={{ marginRight: 10 }}
                    />
                )}

                <ListItem.Content>
                    <ListItem.Title
                        style={{
                            color: themeColor('text'),
                            fontSize: 18,
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    >
                        {item.mintName}
                    </ListItem.Title>
                    <ListItem.Subtitle
                        style={{
                            color: themeColor('secondaryText'),
                            fontSize: 12,
                            fontFamily: 'Lato-Regular',
                            flexWrap: 'wrap',
                            flexShrink: 1
                        }}
                    >
                        {getSubtitle()}
                    </ListItem.Subtitle>
                </ListItem.Content>
                <Amount sats={item.allocatedAmount || item.balance} sensitive />
            </ListItem>
        );
    };

    renderMintIcons = () => {
        const { mints } = this.state;
        const { CashuStore } = this.props;
        const successMints = mints.filter(
            (m) => m.status === MintPaymentStatus.SUCCESS
        );
        const displayMints = successMints.slice(0, 3);
        const remainingCount = successMints.length - displayMints.length;

        return (
            <View style={styles.mintIconsContainer}>
                {displayMints.map((mint, index) => {
                    const mintInfo = CashuStore?.mintInfos[mint.mintUrl];
                    return (
                        <View
                            key={mint.mintUrl}
                            style={[
                                styles.mintIconWrapperLarge,
                                {
                                    marginLeft: index > 0 ? -16 : 0,
                                    zIndex: 3 - index
                                }
                            ]}
                        >
                            <MintAvatar
                                iconUrl={mintInfo?.icon_url}
                                name={mintInfo?.name || mint.mintName}
                                size="medium"
                            />
                        </View>
                    );
                })}
                {remainingCount > 0 && (
                    <Text
                        style={{
                            ...styles.moreMintsText,
                            color: themeColor('secondaryText')
                        }}
                    >
                        +{remainingCount}
                    </Text>
                )}
            </View>
        );
    };

    render() {
        const { navigation, CashuStore, route } = this.props;
        const { mints, totalSelectedBalance, step, error, showPaymentDetails } =
            this.state;
        const windowSize = Dimensions.get('window');

        const paymentAmount =
            CashuStore?.payReq?.getRequestAmount ||
            Number(route.params?.paymentAmount || 0);

        const hasError =
            step === MultinutPaymentStep.FAILED ||
            !!error ||
            !!CashuStore?.paymentError;
        const errorMessage = error || CashuStore?.paymentErrorMsg;
        const isComplete = step === MultinutPaymentStep.COMPLETE;

        return (
            <Screen>
                {!isComplete && (
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.SendingLightning.sending'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                )}

                {isComplete && !hasError ? (
                    <>
                        <View
                            style={{
                                ...sendingStyles.content,
                                paddingTop: windowSize.height * 0.05
                            }}
                        >
                            <Wordmark
                                height={windowSize.width * 0.25}
                                width={windowSize.width}
                                fill={themeColor('highlight')}
                            />
                            <PaymentSuccessView
                                paymentAmount={paymentAmount}
                                feeAmount={CashuStore?.paymentFee}
                                paymentDuration={CashuStore?.paymentDuration}
                            />
                            {this.renderMintIcons()}
                        </View>
                    </>
                ) : (
                    <View style={styles.container}>
                        {hasError ? (
                            <View
                                style={{
                                    ...styles.statusWrap,
                                    paddingTop: windowSize.height * 0.05
                                }}
                            >
                                <ErrorIcon
                                    width={windowSize.height * 0.13}
                                    height={windowSize.height * 0.13}
                                />
                                <Text
                                    style={{
                                        color: themeColor('warning'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        fontSize: 32,
                                        marginTop: 24
                                    }}
                                >
                                    {localeString('general.error')}
                                </Text>
                                {!!errorMessage && (
                                    <Text
                                        style={{
                                            color: themeColor('warning'),
                                            textAlign: 'center',
                                            fontFamily: 'PPNeueMontreal-Book',
                                            marginTop: 8,
                                            paddingHorizontal: 12
                                        }}
                                    >
                                        {errorMessage}
                                    </Text>
                                )}
                            </View>
                        ) : (
                            <View
                                style={{
                                    ...styles.statusWrap,
                                    paddingTop: windowSize.height * 0.05
                                }}
                            >
                                <View style={{ marginBottom: 8 }}>
                                    <Amount
                                        sats={paymentAmount}
                                        sensitive
                                        toggleable
                                        jumboText
                                    />
                                </View>

                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        marginTop: 8
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: themeColor('secondaryText'),
                                            marginRight: 6,
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {localeString(
                                            'views.Cashu.MultimintPayment.totalAvailable'
                                        )}
                                    </Text>
                                    <Amount
                                        sats={totalSelectedBalance}
                                        sensitive
                                        color="secondaryText"
                                    />
                                </View>
                            </View>
                        )}

                        <FlatList
                            data={mints}
                            renderItem={this.renderMintItem}
                            keyExtractor={(item) => item.mintUrl}
                            style={styles.mintsList}
                            showsVerticalScrollIndicator={false}
                            ItemSeparatorComponent={this.renderSeparator}
                        />
                    </View>
                )}

                {isComplete && !hasError && (
                    <PaymentDetailsSheet
                        isOpen={showPaymentDetails}
                        onOpen={() =>
                            this.setState({ showPaymentDetails: true })
                        }
                        onClose={() =>
                            this.setState({ showPaymentDetails: false })
                        }
                        paymentAmount={paymentAmount}
                        feeAmount={CashuStore?.paymentFee}
                        paymentDuration={CashuStore?.paymentDuration}
                        paymentHash={
                            CashuStore?.payReq?.payment_hash || undefined
                        }
                        paymentPreimage={CashuStore?.paymentPreimage}
                        mintPayments={mints
                            .filter(
                                (m) => m.status === MintPaymentStatus.SUCCESS
                            )
                            .map((m) => {
                                const mintInfo =
                                    CashuStore?.mintInfos[m.mintUrl];
                                return {
                                    mintUrl: m.mintUrl,
                                    mintName: m.mintName,
                                    iconUrl: mintInfo?.icon_url,
                                    amount: m.allocatedAmount || 0,
                                    fee: m.feePaid
                                };
                            })}
                        navigation={navigation}
                    />
                )}

                <View
                    style={[
                        styles.bottomSection,
                        isComplete && { marginTop: 15 }
                    ]}
                >
                    {step === MultinutPaymentStep.PROCESSING && !hasError && (
                        <Button
                            title={localeString('general.cancel')}
                            onPress={() => navigation.goBack()}
                            noUppercase
                        />
                    )}

                    {isComplete && !hasError && CashuStore?.noteKey && (
                        <Button
                            title={localeString(
                                'views.SendingLightning.AddANote'
                            )}
                            onPress={() =>
                                navigation.navigate('AddNotes', {
                                    noteKey: CashuStore.noteKey
                                })
                            }
                            secondary
                        />
                    )}

                    {hasError && (
                        <>
                            <Button
                                title={localeString(
                                    'views.SendingLightning.tryAgain'
                                )}
                                icon={{
                                    name: 'rotate-ccw',
                                    type: 'feather',
                                    size: 25
                                }}
                                onPress={() => navigation.goBack()}
                                secondary
                            />
                            <Button
                                title={localeString(
                                    'views.Settings.Ecash.cashuTroubleshooting'
                                )}
                                icon={{
                                    name: 'life-buoy',
                                    type: 'feather',
                                    size: 25
                                }}
                                onPress={() => {
                                    UrlUtils.goToUrl(
                                        'https://docs.zeusln.app/cashu#i-get-an-error-saying-outputs-have-already-been-signed-before-or-already-spent-what-should-i-do'
                                    );
                                }}
                                secondary
                            />
                        </>
                    )}

                    {step !== MultinutPaymentStep.PROCESSING && (
                        <Button
                            title={localeString(
                                'views.SendingLightning.goToWallet'
                            )}
                            icon={{
                                name: 'list',
                                size: 25,
                                color: themeColor('background')
                            }}
                            onPress={() => navigation.popTo('Wallet')}
                            buttonStyle={{ height: 40 }}
                            titleStyle={{ color: themeColor('background') }}
                        />
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20
    },
    statusWrap: {
        alignItems: 'center',
        justifyContent: 'space-evenly'
    },
    mintsList: {
        flex: 1,
        marginBottom: 20,
        marginTop: 10
    },
    bottomSection: {
        width: '100%',
        justifyContent: 'space-between',
        gap: 15,
        bottom: 15
    },
    mintIconsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8
    },
    mintIconWrapperLarge: {
        width: 42,
        height: 42,
        borderRadius: 21,
        overflow: 'hidden'
    },
    moreMintsText: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 15,
        marginLeft: 4
    }
});
