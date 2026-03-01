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
import { StackNavigationProp } from '@react-navigation/stack';
import { Icon, ListItem } from '@rneui/themed';

import Amount from '../../components/Amount';
import Button from '../../components/Button';
import Header from '../../components/Header';
import LightningLoadingPattern from '../../components/LightningLoadingPattern';
import PaidIndicator from '../../components/PaidIndicator';
import Screen from '../../components/Screen';
import SuccessAnimation from '../../components/SuccessAnimation';

import CashuStore from '../../stores/CashuStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import ErrorIcon from '../../assets/images/SVG/ErrorIcon.svg';
import Wordmark from '../../assets/images/SVG/wordmark-black.svg';

enum MultimintStep {
    Processing = 'processing',
    Complete = 'complete',
    Failed = 'failed'
}

type MintStatus = 'idle' | 'processing' | 'success' | 'failed';

interface MintInfo {
    mintUrl: string;
    mintName?: string;
    balance: number;
    status: MintStatus;
    error?: string;
}

interface MultimintPaymentProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'MultimintPayment', { paymentAmount?: string }>;
    CashuStore?: CashuStore;
}

interface MultimintPaymentState {
    mints: MintInfo[];
    step: MultimintStep;
    isProcessing: boolean;
    error?: string;
}

@inject('CashuStore')
@observer
export default class MultimintPayment extends React.Component<
    MultimintPaymentProps,
    MultimintPaymentState
> {
    constructor(props: MultimintPaymentProps) {
        super(props);
        const { CashuStore } = props;
        const selectedMintUrls = CashuStore?.selectedMintUrls || [];

        const mints = selectedMintUrls.map((mintUrl) => ({
            mintUrl,
            mintName: CashuStore?.mintInfos[mintUrl]?.name || mintUrl,
            balance: CashuStore?.mintBalances[mintUrl] || 0,
            status: 'idle' as MintStatus
        }));

        this.state = {
            mints,
            step: mints.length
                ? MultimintStep.Processing
                : MultimintStep.Failed,
            isProcessing: false,
            error:
                mints.length === 0
                    ? localeString(
                          'views.Cashu.MultimintPayment.noMintsSelected'
                      )
                    : undefined
        };
    }

    componentDidMount(): void {
        if (this.state.step !== MultimintStep.Failed) {
            this.executePayment();
        }
    }

    executePayment = async () => {
        const { CashuStore, route } = this.props;
        if (!CashuStore) {
            this.setState({
                step: MultimintStep.Failed,
                error: 'CashuStore not available'
            });
            return;
        }

        try {
            this.setState((prevState) => ({
                isProcessing: true,
                step: MultimintStep.Processing,
                error: undefined,
                mints: prevState.mints.map((mint) => ({
                    ...mint,
                    status: 'processing',
                    error: undefined
                }))
            }));

            const paymentAmount = route.params?.paymentAmount;
            const payment = await CashuStore.payLnInvoiceFromEcash({
                amount: paymentAmount
            });
            const successfulMints = new Set(
                CashuStore.lastMultiMintUsedMints || []
            );

            if (!payment || CashuStore.paymentError) {
                this.setState((prevState) => ({
                    isProcessing: false,
                    step: MultimintStep.Failed,
                    error:
                        CashuStore.paymentErrorMsg ||
                        localeString('stores.CashuStore.errorPayingInvoice'),
                    mints: prevState.mints.map((mint) => ({
                        ...mint,
                        status: 'failed'
                    }))
                }));
                return;
            }

            this.setState((prevState) => ({
                isProcessing: false,
                step: MultimintStep.Complete,
                mints: prevState.mints.map((mint) => ({
                    ...mint,
                    status: successfulMints.has(mint.mintUrl)
                        ? 'success'
                        : 'idle'
                }))
            }));
        } catch (error: any) {
            this.setState((prevState) => ({
                isProcessing: false,
                step: MultimintStep.Failed,
                error:
                    error?.message ||
                    localeString('stores.CashuStore.errorPayingInvoice'),
                mints: prevState.mints.map((mint) => ({
                    ...mint,
                    status: 'failed'
                }))
            }));
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

    renderMintItem = ({ item }: { item: MintInfo }) => {
        let subtitle = item.mintUrl;
        if (item.status === 'success') {
            subtitle = `${localeString('general.success')} | ${item.mintUrl}`;
        }
        if (item.status === 'failed') {
            subtitle = `${localeString('general.failed')} | ${item.mintUrl}`;
        }

        return (
            <ListItem
                containerStyle={{
                    borderBottomWidth: 0,
                    backgroundColor: 'transparent'
                }}
            >
                {item.status === 'processing' && (
                    <ActivityIndicator
                        size="small"
                        color={themeColor('highlight')}
                        style={{ marginRight: 10 }}
                    />
                )}
                {item.status === 'success' && (
                    <Icon
                        name="check-circle"
                        color={themeColor('success')}
                        size={20}
                        style={{ marginRight: 10 }}
                    />
                )}
                {item.status === 'failed' && (
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
                            fontFamily: 'Lato-Regular'
                        }}
                    >
                        {subtitle}
                    </ListItem.Subtitle>
                </ListItem.Content>
                <Amount sats={item.balance} sensitive />
            </ListItem>
        );
    };

    render() {
        const { CashuStore, navigation } = this.props;
        const { mints, step, isProcessing, error } = this.state;
        const windowSize = Dimensions.get('window');
        const showLoading = step === MultimintStep.Processing && isProcessing;
        const showError = step === MultimintStep.Failed;
        const showSuccess = step === MultimintStep.Complete;

        const paymentAmount =
            CashuStore?.payReq?.getRequestAmount ||
            Number(this.props.route.params?.paymentAmount || 0);

        if (showLoading) {
            return (
                <Screen>
                    <View
                        style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <LightningLoadingPattern />
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                paddingBottom: windowSize.height / 10,
                                fontSize:
                                    windowSize.width * windowSize.scale * 0.014
                            }}
                        >
                            {localeString('views.SendingLightning.sending')}
                        </Text>
                    </View>
                </Screen>
            );
        }

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.SendingLightning.sending'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />

                <View style={styles.container}>
                    <View
                        style={{
                            ...styles.statusWrap,
                            paddingTop: windowSize.height * 0.05
                        }}
                    >
                        {!showError && (
                            <Wordmark
                                height={windowSize.width * 0.25}
                                width={windowSize.width}
                                fill={themeColor('highlight')}
                            />
                        )}

                        {showSuccess && (
                            <>
                                <PaidIndicator />
                                <View style={{ alignItems: 'center' }}>
                                    <SuccessAnimation />
                                    <Text
                                        style={[
                                            styles.successText,
                                            { color: themeColor('text') }
                                        ]}
                                    >
                                        {localeString(
                                            'views.SendingLightning.success'
                                        )}
                                    </Text>
                                    <View style={{ marginTop: 10 }}>
                                        <Amount
                                            sats={paymentAmount}
                                            sensitive
                                            toggleable
                                            jumboText
                                        />
                                    </View>
                                </View>
                            </>
                        )}

                        {showError && (
                            <View style={{ alignItems: 'center' }}>
                                <ErrorIcon
                                    width={windowSize.height * 0.13}
                                    height={windowSize.height * 0.13}
                                />
                                <Text
                                    style={[
                                        styles.errorTitle,
                                        { color: themeColor('warning') }
                                    ]}
                                >
                                    {localeString('general.error')}
                                </Text>
                                {!!error && (
                                    <Text
                                        style={[
                                            styles.errorText,
                                            { color: themeColor('warning') }
                                        ]}
                                    >
                                        {error}
                                    </Text>
                                )}
                            </View>
                        )}
                    </View>

                    <FlatList
                        data={mints}
                        renderItem={this.renderMintItem}
                        keyExtractor={(item) => item.mintUrl}
                        style={styles.mintsList}
                        showsVerticalScrollIndicator={false}
                        ItemSeparatorComponent={this.renderSeparator}
                    />
                </View>

                <View style={styles.bottomSection}>
                    {(showError || !!CashuStore?.paymentErrorMsg) && (
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
                    )}

                    {showError && (
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
                    )}

                    {showSuccess && CashuStore?.noteKey && (
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

                    {(showSuccess || showError) && (
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
                            titleStyle={{
                                color: themeColor('background')
                            }}
                        />
                    )}

                    {!showSuccess && !showError && (
                        <>
                            <Button
                                title={localeString('general.cancel')}
                                onPress={() => navigation.goBack()}
                                noUppercase
                            />
                        </>
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
        marginBottom: 20
    },
    bottomSection: {
        width: '100%',
        justifyContent: 'space-between',
        gap: 15,
        bottom: 15
    },
    errorTitle: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 32,
        marginTop: 32
    },
    errorText: {
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center'
    },
    successText: {
        paddingTop: 20,
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 18
    }
});
