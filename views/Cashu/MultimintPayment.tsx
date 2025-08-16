import * as React from 'react';
import {
    StyleSheet,
    View,
    ActivityIndicator,
    FlatList,
    Text
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { ListItem, Icon } from 'react-native-elements';

import Amount from '../../components/Amount';
import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import { ErrorMessage } from '../../components/SuccessErrorMessage';

import { themeColor } from '../../utils/ThemeUtils';
import { MintPaymentStatus, MultinutPaymentStep } from '../../utils/CashuUtils';
import { localeString } from '../../utils/LocaleUtils';
import UrlUtils from '../../utils/UrlUtils';

import CashuStore from '../../stores/CashuStore';
import SettingsStore from '../../stores/SettingsStore';
import UnitsStore from '../../stores/UnitsStore';

interface MultimintPaymentProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore?: CashuStore;
    SettingsStore?: SettingsStore;
    UnitsStore?: UnitsStore;
}

interface MintInfo {
    mintUrl: string;
    mintName?: string;
    balance: number;
    status: MintPaymentStatus;
    allocatedAmount?: number;
    error?: string;
}

interface MultimintPaymentState {
    mints: MintInfo[];
    totalSelectedBalance: number;
    paymentRequest: string;
    isProcessing: boolean;
    step: MultinutPaymentStep;
    error?: string;
}

@inject('CashuStore', 'SettingsStore', 'UnitsStore')
@observer
export default class MultimintPayment extends React.Component<
    MultimintPaymentProps,
    MultimintPaymentState
> {
    constructor(props: MultimintPaymentProps) {
        super(props);
        const { CashuStore } = props;
        const paymentRequest = CashuStore?.paymentRequest || '';

        const selectedMintUrls = CashuStore?.selectedMintUrls || [];
        const availableMints = CashuStore?.getMultimintInfo() || [];

        const selectedMints = availableMints
            .filter((mint) => selectedMintUrls.includes(mint.mintUrl))
            .map((mint) => ({
                ...mint,
                status: MintPaymentStatus.IDLE,
                allocatedAmount: 0,
                error: undefined
            }));

        const totalBalance = selectedMints.reduce(
            (sum, mint) => sum + mint.balance,
            0
        );

        this.state = {
            mints: selectedMints,
            totalSelectedBalance: totalBalance,
            paymentRequest,
            isProcessing: false,
            step: MultinutPaymentStep.PROCESSING,
            error: undefined
        };
    }

    componentDidMount() {
        this.executePayment();
    }

    onProgressUpdate = (progressInfo: {
        mints: MintInfo[];
        isProcessing: boolean;
        step: MultinutPaymentStep;
    }) => {
        this.setState((prev) => ({
            mints: prev.mints.map((m) => {
                const updated = progressInfo.mints.find(
                    (u) => u.mintUrl === m.mintUrl
                );
                return updated ? { ...m, ...updated } : m;
            }),
            isProcessing: progressInfo.isProcessing ?? prev.isProcessing,
            step: progressInfo.step || prev.step
        }));
    };

    executePayment = async () => {
        const { CashuStore } = this.props;
        const amount =
            (CashuStore?.payReq?.getRequestAmount ?? 0) +
            (CashuStore?.feeEstimate ?? 0);

        if (!CashuStore) {
            this.setState({
                error: 'CashuStore not available',
                step: MultinutPaymentStep.FAILED,
                isProcessing: false
            });
            return;
        }

        try {
            this.setState({
                isProcessing: true,
                step: MultinutPaymentStep.PROCESSING,
                error: undefined,
                mints: this.state.mints.map((m) => ({
                    ...m,
                    status: MintPaymentStatus.IDLE,
                    error: undefined
                }))
            });

            await CashuStore.payLnInvoiceFromEcash({
                amount: amount.toString(),
                onProgress: this.onProgressUpdate
            });

            this.setState({
                step: MultinutPaymentStep.COMPLETE,
                isProcessing: false
            });
        } catch (error: any) {
            console.error('Payment failed:', error);
            this.setState({
                error: error.message || 'Payment failed',
                isProcessing: false,
                step: MultinutPaymentStep.FAILED
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

    renderMintItem = ({ item }: { item: MintInfo }) => {
        const { isProcessing } = this.state;

        const getSubtitle = () => {
            if (item.status === MintPaymentStatus.SUCCESS)
                return `Success | ${item.mintUrl}`;
            if (item.status === MintPaymentStatus.FAILED)
                return `Failed | ${item.error || 'Unknown error'}`;
            if (item.status === MintPaymentStatus.PAYING && isProcessing)
                return `Paying... | ${item.mintUrl}`;
            if (item.status === MintPaymentStatus.REQUESTING && isProcessing)
                return `Requesting... | ${item.mintUrl}`;
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
                    <View>
                        <View style={styles.row}>
                            <ListItem.Title
                                style={{
                                    color: themeColor('text'),
                                    fontSize: 18
                                }}
                            >
                                {item.mintName}
                            </ListItem.Title>
                        </View>
                        <View style={styles.row}>
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
                        </View>
                    </View>
                </ListItem.Content>
                <Amount sats={item.balance} sensitive />
            </ListItem>
        );
    };

    render() {
        const { navigation, CashuStore } = this.props;
        const amount = CashuStore?.feeEstimate
            ? (CashuStore?.payReq?.getRequestAmount ?? 0) +
              CashuStore?.feeEstimate
            : CashuStore?.payReq?.getRequestAmount ?? 0;
        const { mints, totalSelectedBalance, step, error } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: 'Multinut Payment',
                        style: { color: themeColor('text') }
                    }}
                    navigation={navigation}
                />

                {error ||
                    (CashuStore?.error && (
                        <ErrorMessage message={error || CashuStore.error_msg} />
                    ))}

                {!error && !CashuStore?.error && (
                    <View style={styles.container}>
                        <View style={styles.headerSection}>
                            <Amount
                                sats={amount}
                                sensitive
                                toggleable
                                jumboText
                            />
                            {amount > 0 && (
                                <View
                                    style={{
                                        marginTop: 10,
                                        alignItems: 'center'
                                    }}
                                >
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontSize: 16,
                                                marginRight: 5
                                            }}
                                        >
                                            Total Available:
                                        </Text>
                                        <Amount
                                            sats={totalSelectedBalance}
                                            sensitive
                                            color="secondaryText"
                                        />
                                    </View>
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

                        <View style={styles.bottomSection}>
                            {step === MultinutPaymentStep.PROCESSING && (
                                <Button
                                    title={localeString('general.cancel')}
                                    onPress={() => navigation.goBack()}
                                    containerStyle={{ marginTop: 15 }}
                                    noUppercase
                                />
                            )}

                            {step !== MultinutPaymentStep.PROCESSING && (
                                <>
                                    {step === MultinutPaymentStep.FAILED && (
                                        <>
                                            <Button
                                                title={localeString(
                                                    'views.SendingLightning.tryAgain'
                                                )}
                                                icon={{
                                                    name: 'return-up-back',
                                                    type: 'ionicon',
                                                    size: 25
                                                }}
                                                onPress={() =>
                                                    navigation.goBack()
                                                }
                                                buttonStyle={{
                                                    backgroundColor: 'white',
                                                    height: 40
                                                }}
                                                containerStyle={{
                                                    width: '100%',
                                                    margin: 3
                                                }}
                                            />
                                            <Button
                                                title={localeString(
                                                    'views.Settings.Ecash.cashuTroubleshooting'
                                                )}
                                                icon={{
                                                    name: 'help-buoy-outline',
                                                    type: 'ionicon',
                                                    size: 25
                                                }}
                                                onPress={() => {
                                                    UrlUtils.goToUrl(
                                                        'https://docs.zeusln.app/cashu#i-get-an-error-saying-outputs-have-already-been-signed-before-or-already-spent-what-should-i-do'
                                                    );
                                                }}
                                                containerStyle={{
                                                    width: '100%',
                                                    margin: 3
                                                }}
                                                secondary
                                            />
                                        </>
                                    )}

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
                                        buttonStyle={{ height: 40 }}
                                        titleStyle={{
                                            color: themeColor('background')
                                        }}
                                        containerStyle={{
                                            width: '100%',
                                            margin: 3
                                        }}
                                    />
                                </>
                            )}
                        </View>
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingLeft: 20,
        paddingRight: 20
    },
    headerSection: {
        marginBottom: 24,
        alignItems: 'center'
    },
    mintsList: {
        flex: 1,
        marginBottom: 20
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-end'
    },
    bottomSection: {
        paddingTop: 20,
        paddingBottom: 10
    }
});
