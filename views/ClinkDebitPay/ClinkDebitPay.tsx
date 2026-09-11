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

import ClinkUtils, {
    ClinkRequestError,
    NdebitData,
    isNdebitSuccess
} from '../../utils/ClinkUtils';
import { errorToUserFriendly } from '../../utils/ErrorUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import InvoicesStore from '../../stores/InvoicesStore';

interface ClinkDebitPayProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<'ClinkDebitPay', { ndebit: string }>;
    InvoicesStore?: InvoicesStore;
}

interface ClinkDebitPayState {
    ndebit: string;
    ndebitData: NdebitData | null;
    amount: string;
    satAmount: string | number;
    loading: boolean;
    status: string;
}

const truncatePubkey = (pubkeyHex: string): string => {
    try {
        const npub = nip19.npubEncode(pubkeyHex);
        return `${npub.slice(0, 12)}\u2026${npub.slice(-6)}`;
    } catch {
        return `${pubkeyHex.slice(0, 8)}\u2026${pubkeyHex.slice(-6)}`;
    }
};

const localizeDebitError = (e: any): string => {
    if (e instanceof ClinkRequestError) {
        switch (e.code) {
            case 'NO_RELAYS':
                return localeString('views.ClinkDebitPay.errorNoRelays');
            case 'ONION_NOT_SUPPORTED':
                return e.detail
                    ? `${localeString(
                          'views.ClinkDebitPay.errorOnionNotSupported'
                      )} (${e.detail})`
                    : localeString(
                          'views.ClinkDebitPay.errorOnionNotSupported'
                      );
            case 'RELAY_CONNECT_FAILED':
                return e.detail
                    ? `${localeString(
                          'views.ClinkDebitPay.errorRelayConnectFailed'
                      )} \u2014 ${e.detail}`
                    : localeString(
                          'views.ClinkDebitPay.errorRelayConnectFailed'
                      );
            case 'RELAY_REJECTED_PUBLISH':
                return e.detail
                    ? `${localeString(
                          'views.ClinkDebitPay.errorRelayRejectedPublish'
                      )}: ${e.detail}`
                    : localeString(
                          'views.ClinkDebitPay.errorRelayRejectedPublish'
                      );
            case 'TIMEOUT':
                return localeString('views.ClinkDebitPay.errorTimeout');
        }
    }
    return errorToUserFriendly(e);
};

@inject('InvoicesStore')
@observer
export default class ClinkDebitPay extends React.Component<
    ClinkDebitPayProps,
    ClinkDebitPayState
> {
    constructor(props: ClinkDebitPayProps) {
        super(props);
        const ndebit = props.route.params?.ndebit || '';
        let ndebitData: NdebitData | null = null;
        try {
            ndebitData = ClinkUtils.decodeNdebit(ndebit);
        } catch (err: any) {
            Alert.alert(
                localeString('views.ClinkDebitPay.invalidDebit'),
                err?.message ||
                    localeString('utils.handleAnything.invalidNdebit'),
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
            ndebit,
            ndebitData,
            amount: '',
            satAmount: '0',
            loading: false,
            status: ''
        };
    }

    confirm = async () => {
        const { navigation, InvoicesStore } = this.props;
        const { ndebitData, satAmount } = this.state;
        if (!ndebitData || !InvoicesStore) return;

        const sats = Number(satAmount);
        if (!sats || sats <= 0) {
            Alert.alert(
                localeString('views.ClinkDebitPay.title'),
                localeString('views.ClinkDebitPay.specifyAmount'),
                [{ text: localeString('general.ok') }],
                { cancelable: false }
            );
            return;
        }

        this.setState({
            loading: true,
            status: localeString('views.ClinkDebitPay.generatingInvoice')
        });

        // Generate a bolt11 invoice using Zeus's own node
        let invoice: string;
        try {
            await InvoicesStore.createInvoice({
                memo: localeString('views.ClinkDebitPay.invoiceMemo'),
                value: sats.toString(),
                expirySeconds: '300' // 5 minutes
            });
            const pr = InvoicesStore.payment_request;
            if (!pr) throw new Error('No invoice returned');
            invoice = pr;
        } catch (e: any) {
            this.setState({ loading: false, status: '' });
            Alert.alert(
                localeString('views.ClinkDebitPay.title'),
                `${localeString(
                    'views.ClinkDebitPay.invoiceGenFailed'
                )}: ${errorToUserFriendly(e)}`,
                [{ text: localeString('general.ok') }],
                { cancelable: false }
            );
            return;
        }

        this.setState({
            status: localeString('views.ClinkDebitPay.sendingRequest')
        });

        let res;
        try {
            res = await ClinkUtils.requestPaymentFromNdebit(
                ndebitData,
                invoice,
                sats
            );
        } catch (e: any) {
            this.setState({ loading: false, status: '' });
            Alert.alert(
                localeString('views.ClinkDebitPay.title'),
                localizeDebitError(e),
                [{ text: localeString('general.ok') }],
                { cancelable: false }
            );
            return;
        }

        this.setState({ loading: false, status: '' });

        if (!isNdebitSuccess(res)) {
            Alert.alert(
                localeString('views.ClinkDebitPay.title'),
                `${localeString('views.ClinkDebitPay.requestDenied')} (${
                    res.code
                }): ${res.error}`,
                [{ text: localeString('general.ok') }],
                { cancelable: false }
            );
            return;
        }

        // Payment was sent by the node service — show success
        Alert.alert(
            localeString('views.ClinkDebitPay.successTitle'),
            res.preimage
                ? `${localeString(
                      'views.ClinkDebitPay.successMsg'
                  )}\n\n${localeString(
                      'views.ClinkDebitPay.preimage'
                  )}: ${res.preimage.slice(0, 16)}\u2026`
                : localeString('views.ClinkDebitPay.successMsg'),
            [
                {
                    text: localeString('general.ok'),
                    onPress: () => navigation.goBack()
                }
            ],
            { cancelable: false }
        );
    };

    render() {
        const { navigation } = this.props;
        const { ndebitData, amount, loading, status } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.ClinkDebitPay.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {ndebitData && (
                        <View style={styles.infoBox}>
                            <Text
                                style={[
                                    styles.label,
                                    { color: themeColor('secondaryText') }
                                ]}
                            >
                                {localeString(
                                    'views.ClinkDebitPay.serviceLabel'
                                )}
                            </Text>
                            <Text
                                style={[
                                    styles.pubkey,
                                    { color: themeColor('text') }
                                ]}
                                numberOfLines={1}
                                ellipsizeMode="middle"
                            >
                                {truncatePubkey(ndebitData.pubkey)}
                            </Text>
                            {ndebitData.pointer && (
                                <>
                                    <Text
                                        style={[
                                            styles.label,
                                            {
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }
                                        ]}
                                    >
                                        {localeString(
                                            'views.ClinkDebitPay.pointerLabel'
                                        )}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.pubkey,
                                            { color: themeColor('text') }
                                        ]}
                                    >
                                        {ndebitData.pointer}
                                    </Text>
                                </>
                            )}
                            {ndebitData.k1 && (
                                <Text
                                    style={[
                                        styles.session,
                                        {
                                            color: themeColor('secondaryText')
                                        }
                                    ]}
                                >
                                    {localeString(
                                        'views.ClinkDebitPay.sessionLabel'
                                    )}
                                </Text>
                            )}
                        </View>
                    )}

                    <AmountInput
                        amount={amount}
                        onAmountChange={(
                            value: string,
                            satValue: string | number
                        ) => {
                            this.setState({
                                amount: value,
                                satAmount: satValue
                            });
                        }}
                    />

                    {loading && (
                        <View style={styles.loadingRow}>
                            <LoadingIndicator size={24} />
                            {!!status && (
                                <Text
                                    style={[
                                        styles.statusText,
                                        { color: themeColor('text') }
                                    ]}
                                >
                                    {status}
                                </Text>
                            )}
                        </View>
                    )}

                    <View style={styles.buttonRow}>
                        <Button
                            title={localeString('general.confirm')}
                            onPress={this.confirm}
                            disabled={loading || !ndebitData}
                        />
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingHorizontal: 20
    },
    infoBox: {
        marginVertical: 16,
        padding: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(128,128,128,0.1)'
    },
    label: {
        fontSize: 12,
        marginTop: 8,
        fontFamily: 'PPNeueMontreal-Book'
    },
    pubkey: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book',
        marginTop: 2
    },
    session: {
        fontSize: 11,
        marginTop: 8,
        fontStyle: 'italic',
        fontFamily: 'PPNeueMontreal-Book'
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
        gap: 12
    },
    statusText: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book',
        flexShrink: 1
    },
    buttonRow: {
        marginTop: 24,
        marginBottom: 32
    }
});
