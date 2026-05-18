import * as React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// @ts-ignore:next-line
import { nip19 } from 'nostr-tools';

import AmountInput from '../../components/AmountInput';
import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';

import CashuStore from '../../stores/CashuStore';
import InvoicesStore from '../../stores/InvoicesStore';

import ClinkUtils, {
    ClinkRequestError,
    NofferData,
    NofferPriceType,
    NofferErrorCode,
    isNofferSuccess
} from '../../utils/ClinkUtils';
import { errorToUserFriendly } from '../../utils/ErrorUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { getAmountFromSats } from '../../utils/AmountUtils';

interface ClinkPayProps {
    navigation: NativeStackNavigationProp<any, any>;
    InvoicesStore: InvoicesStore;
    CashuStore: CashuStore;
    route: Route<
        'ClinkPay',
        {
            noffer: string;
            ecash?: boolean;
        }
    >;
}

interface ClinkPayState {
    noffer: string;
    nofferData: NofferData | null;
    amount: string;
    satAmount: string | number;
    loading: boolean;
}

const truncatePubkey = (pubkeyHex: string): string => {
    try {
        const npub = nip19.npubEncode(pubkeyHex);
        return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
    } catch {
        return `${pubkeyHex.slice(0, 8)}…${pubkeyHex.slice(-6)}`;
    }
};

// Map a thrown ClinkRequestError to a localized message. Falls back to
// errorToUserFriendly for anything else.
const localizeRequestError = (e: any): string => {
    if (e instanceof ClinkRequestError) {
        switch (e.code) {
            case 'NO_RELAYS':
                return localeString('views.ClinkPay.errorNoRelays');
            case 'ONION_NOT_SUPPORTED':
                return e.detail
                    ? `${localeString(
                          'views.ClinkPay.errorOnionNotSupported'
                      )} (${e.detail})`
                    : localeString('views.ClinkPay.errorOnionNotSupported');
            case 'RELAY_CONNECT_FAILED':
                return e.detail
                    ? `${localeString(
                          'views.ClinkPay.errorRelayConnectFailed'
                      )} — ${e.detail}`
                    : localeString('views.ClinkPay.errorRelayConnectFailed');
            case 'RELAY_REJECTED_PUBLISH':
                return e.detail
                    ? `${localeString(
                          'views.ClinkPay.errorRelayRejectedPublish'
                      )}: ${e.detail}`
                    : localeString('views.ClinkPay.errorRelayRejectedPublish');
            case 'TIMEOUT':
                return localeString('views.ClinkPay.errorTimeout');
        }
    }
    return errorToUserFriendly(e);
};

const errorCodeToLocaleKey = (code?: NofferErrorCode): string | null => {
    switch (code) {
        case NofferErrorCode.InvalidOffer:
            return 'views.ClinkPay.errorInvalidOffer';
        case NofferErrorCode.TemporaryFailure:
            return 'views.ClinkPay.errorTemporaryFailure';
        case NofferErrorCode.ExpiredOrMoved:
            return 'views.ClinkPay.errorExpired';
        case NofferErrorCode.UnsupportedFeature:
            return 'views.ClinkPay.errorUnsupportedFeature';
        case NofferErrorCode.InvalidAmount:
            return 'views.ClinkPay.errorInvalidAmount';
        default:
            return null;
    }
};

@inject('InvoicesStore', 'CashuStore')
@observer
export default class ClinkPay extends React.Component<
    ClinkPayProps,
    ClinkPayState
> {
    constructor(props: ClinkPayProps) {
        super(props);
        const noffer = props.route.params?.noffer || '';
        let nofferData: NofferData | null = null;
        let amount = '';
        let satAmount: string | number = '0';
        try {
            nofferData = ClinkUtils.decodeNoffer(noffer);
            if (
                nofferData.priceType === NofferPriceType.Fixed &&
                nofferData.price
            ) {
                satAmount = nofferData.price.toString();
                amount =
                    getAmountFromSats(nofferData.price.toString()) ||
                    nofferData.price.toString();
            }
        } catch (err: any) {
            Alert.alert(
                localeString('views.ClinkPay.invalidOffer'),
                err?.message ||
                    localeString('utils.handleAnything.invalidNoffer'),
                [
                    {
                        text: localeString('general.ok'),
                        onPress: () => props.navigation.goBack()
                    }
                ],
                { cancelable: false }
            );
        }
        this.state = {
            noffer,
            nofferData,
            amount,
            satAmount,
            loading: false
        };
    }

    confirm = async () => {
        const { navigation, InvoicesStore, CashuStore, route } = this.props;
        const ecash = route.params?.ecash;
        const { nofferData, satAmount } = this.state;
        if (!nofferData) return;

        const priceType = nofferData.priceType;
        const requiresAmount =
            priceType === NofferPriceType.Spontaneous ||
            priceType === NofferPriceType.Variable;
        if (
            requiresAmount &&
            (!satAmount || satAmount === '0' || Number(satAmount) <= 0)
        ) {
            Alert.alert(
                localeString('views.ClinkPay.title'),
                localeString('views.ClinkPay.specifyAmount'),
                [{ text: localeString('general.ok') }],
                { cancelable: false }
            );
            return;
        }

        this.setState({ loading: true });

        let res;
        try {
            const amountSats =
                priceType === NofferPriceType.Fixed
                    ? undefined
                    : Number(satAmount);
            res = await ClinkUtils.requestInvoiceFromNoffer(nofferData, {
                amountSats
            });
        } catch (e: any) {
            this.setState({ loading: false });
            Alert.alert(
                localeString('views.ClinkPay.title'),
                localizeRequestError(e),
                [{ text: localeString('general.ok') }],
                { cancelable: false }
            );
            return;
        }

        if (!isNofferSuccess(res)) {
            this.setState({ loading: false });
            const key = errorCodeToLocaleKey(res.code);
            const baseMsg = key
                ? localeString(key)
                : localeString('views.ClinkPay.invoiceFetchFailure');
            const detail = res.error ? ` — ${res.error}` : '';
            Alert.alert(
                localeString('views.ClinkPay.title'),
                `${baseMsg}${detail}`,
                [{ text: localeString('general.ok') }],
                { cancelable: false }
            );
            return;
        }

        const requestedAmount =
            priceType === NofferPriceType.Fixed ? undefined : Number(satAmount);
        const mismatch = ClinkUtils.verifyBolt11MatchesOffer(
            res.bolt11,
            nofferData,
            requestedAmount
        );
        if (mismatch) {
            this.setState({ loading: false });
            Alert.alert(
                localeString('views.ClinkPay.title'),
                `${localeString(
                    'views.ClinkPay.invoiceAmountMismatch'
                )} — ${mismatch}`,
                [{ text: localeString('general.ok') }],
                { cancelable: false }
            );
            return;
        }

        try {
            if (ecash) {
                // Load both stores so ChoosePaymentMethod can offer the
                // Lightning and ecash routes side-by-side. Mirrors LnurlPay.
                await Promise.all([
                    InvoicesStore.getPayReq(res.bolt11),
                    CashuStore.getPayReq(res.bolt11)
                ]);
                this.setState({ loading: false });
                if (CashuStore.getPayReqError) {
                    Alert.alert(
                        localeString('views.ClinkPay.title'),
                        CashuStore.getPayReqError,
                        [{ text: localeString('general.ok') }],
                        { cancelable: false }
                    );
                    return;
                }
                navigation.navigate('ChoosePaymentMethod', {
                    lightning: res.bolt11,
                    locked: true
                });
            } else {
                await InvoicesStore.getPayReq(res.bolt11);
                this.setState({ loading: false });
                navigation.navigate('PaymentRequest');
            }
        } catch (e: any) {
            this.setState({ loading: false });
            Alert.alert(
                localeString('views.ClinkPay.title'),
                errorToUserFriendly(e),
                [{ text: localeString('general.ok') }],
                { cancelable: false }
            );
        }
    };

    renderPricingLabel() {
        const { nofferData } = this.state;
        if (!nofferData) return null;
        if (nofferData.priceType === NofferPriceType.Fixed) {
            return localeString('views.ClinkPay.fixedAmount');
        }
        if (nofferData.priceType === NofferPriceType.Variable) {
            return `${localeString('views.ClinkPay.variableAmount')}${
                nofferData.currency ? ` (${nofferData.currency})` : ''
            }`;
        }
        return localeString('views.ClinkPay.spontaneousAmount');
    }

    render() {
        const { navigation } = this.props;
        const { nofferData, amount, satAmount, loading } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.ClinkPay.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}
                        >
                            {loading && <LoadingIndicator size={30} />}
                        </View>
                    }
                    navigation={navigation}
                />
                <ScrollView keyboardShouldPersistTaps="handled">
                    {nofferData && (
                        <View style={styles.content}>
                            <View style={styles.headerSection}>
                                <Text
                                    style={[
                                        styles.recipient,
                                        { color: themeColor('text') }
                                    ]}
                                >
                                    {truncatePubkey(nofferData.pubkey)}
                                </Text>
                                <Text
                                    style={[
                                        styles.label,
                                        { color: themeColor('secondaryText') }
                                    ]}
                                >
                                    {this.renderPricingLabel()}
                                </Text>
                            </View>

                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('views.Send.amount')}
                            </Text>
                            <AmountInput
                                amount={amount}
                                onAmountChange={(
                                    newAmount: string,
                                    newSatAmount: string | number
                                ) => {
                                    this.setState({
                                        amount: newAmount,
                                        satAmount: newSatAmount
                                    });
                                }}
                                locked={
                                    loading ||
                                    nofferData.priceType ===
                                        NofferPriceType.Fixed
                                }
                            />

                            <Text
                                style={{
                                    ...styles.relay,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {`${localeString('views.ClinkPay.viaRelay')}: ${
                                    nofferData.relay
                                }`}
                            </Text>

                            <View style={styles.button}>
                                <Button
                                    title={localeString(
                                        'views.ClinkPay.confirm'
                                    )}
                                    onPress={() => this.confirm()}
                                    disabled={
                                        loading ||
                                        (nofferData.priceType !==
                                            NofferPriceType.Fixed &&
                                            (!satAmount ||
                                                satAmount === '0' ||
                                                Number(satAmount) <= 0))
                                    }
                                />
                            </View>
                        </View>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    content: { paddingHorizontal: 20 },
    headerSection: {
        alignItems: 'center',
        paddingVertical: 20
    },
    recipient: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book',
        marginBottom: 6
    },
    label: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book'
    },
    relay: {
        marginTop: 12,
        fontSize: 12,
        fontFamily: 'PPNeueMontreal-Book'
    },
    button: { paddingVertical: 15 }
});
