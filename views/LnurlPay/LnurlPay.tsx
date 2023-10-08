import url from 'url';
import * as React from 'react';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import querystring from 'querystring-es3';

import Amount from '../../components/Amount';
import AmountInput from '../../components/AmountInput';
import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';
import { Row } from '../..//components/layout/Row';

import InvoicesStore from '../../stores/InvoicesStore';
import LnurlPayStore from '../../stores/LnurlPayStore';

import LnurlPayMetadata from './Metadata';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { ScrollView } from 'react-native-gesture-handler';

interface LnurlPayProps {
    navigation: any;
    InvoicesStore: InvoicesStore;
    LnurlPayStore: LnurlPayStore;
}

interface LnurlPayState {
    amount: string;
    satAmount: string | number;
    domain: string;
    comment: string;
}

@inject('InvoicesStore', 'LnurlPayStore')
@observer
export default class LnurlPay extends React.Component<
    LnurlPayProps,
    LnurlPayState
> {
    constructor(props: LnurlPayProps) {
        super(props);

        try {
            this.state = this.stateFromProps(props);
        } catch (err) {
            this.state = {
                amount: '',
                satAmount: '',
                domain: '',
                comment: ''
            };

            Alert.alert(
                localeString('views.LnurlPay.LnurlPay.invalidParams'),
                err.message,
                [{ text: localeString('general.ok'), onPress: () => void 0 }],
                { cancelable: false }
            );
        }
    }

    stateFromProps(props: LnurlPayProps) {
        const { navigation } = props;
        const lnurl = navigation.getParam('lnurlParams');
        const amount = navigation.getParam('amount');

        return {
            amount: amount || Math.floor(lnurl.minSendable / 1000).toString(),
            domain: lnurl.domain,
            comment: ''
        };
    }

    sendValues(satAmount: string | number) {
        const { navigation, InvoicesStore, LnurlPayStore } = this.props;
        const { domain, comment } = this.state;
        const lnurl = navigation.getParam('lnurlParams');
        const u = url.parse(lnurl.callback);
        const qs = querystring.parse(u.query);
        qs.amount = Number((parseFloat(satAmount) * 1000).toString());
        qs.comment = comment;
        u.search = querystring.stringify(qs);
        u.query = querystring.stringify(qs);

        ReactNativeBlobUtil.fetch('get', url.format(u))
            .then((response: any) => {
                try {
                    const data = response.json();
                    return data;
                } catch (err) {
                    return { status: 'ERROR', reason: response.text() };
                }
            })
            .catch((err: any) => ({
                status: 'ERROR',
                reason: err.message
            }))
            .then((data: any) => {
                if (data.status === 'ERROR') {
                    Alert.alert(
                        `[error] ${domain} says:`,
                        data.reason,
                        [
                            {
                                text: localeString('general.ok'),
                                onPress: () => void 0
                            }
                        ],
                        { cancelable: false }
                    );
                    return;
                }

                const pr = data.pr;
                const successAction = data.successAction || {
                    tag: 'noop'
                };

                // Zaplocker data
                const pmthash_sig = data.pmthash_sig;
                const user_pubkey = data.user_pubkey;
                const relays = data.relays;
                const relays_sig = data.relays_sig;

                InvoicesStore.getPayReq(pr).then(() => {
                    if (InvoicesStore.getPayReqError) {
                        Alert.alert(
                            localeString(
                                'views.LnurlPay.LnurlPay.invalidInvoice'
                            ),
                            InvoicesStore.getPayReqError,
                            [
                                {
                                    text: localeString('general.ok'),
                                    onPress: () => void 0
                                }
                            ],
                            { cancelable: false }
                        );
                        return;
                    }

                    const payment_hash: string =
                        (InvoicesStore.pay_req &&
                            InvoicesStore.pay_req.payment_hash) ||
                        '';
                    const description_hash: string =
                        (InvoicesStore.pay_req &&
                            InvoicesStore.pay_req.description_hash) ||
                        '';

                    LnurlPayStore.keep(
                        payment_hash,
                        domain,
                        lnurl.lnurlText,
                        lnurl.metadata,
                        description_hash,
                        successAction,
                        // Zaplocker
                        pmthash_sig,
                        user_pubkey,
                        relays,
                        relays_sig
                    );
                    navigation.navigate('PaymentRequest');
                });
            });
    }

    render() {
        const { navigation } = this.props;
        const { amount, satAmount, domain, comment } = this.state;

        const lnurl = navigation.getParam('lnurlParams');

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('general.send'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView keyboardShouldPersistTaps="handled">
                    <View style={styles.content}>
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('secondaryText'),
                                padding: 20,
                                fontWeight: 'bold',
                                fontSize: 22
                            }}
                        >
                            {domain}
                        </Text>
                    </View>
                    <View style={styles.content}>
                        <Row align="flex-end">
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('views.LnurlPay.LnurlPay.amount')}
                            </Text>
                            {lnurl && lnurl.minSendable !== lnurl.maxSendable && (
                                <>
                                    <Text
                                        style={{
                                            ...styles.text,
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {' ('}
                                    </Text>
                                    <Amount
                                        color="secondaryText"
                                        sats={Math.ceil(
                                            lnurl.minSendable / 1000
                                        )}
                                    />
                                    <Text
                                        style={{
                                            ...styles.text,
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {' - '}
                                    </Text>
                                    <Amount
                                        color="secondaryText"
                                        sats={Math.floor(
                                            lnurl.maxSendable / 1000
                                        )}
                                    />
                                    <Text
                                        style={{
                                            ...styles.text,
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {'):'}
                                    </Text>
                                </>
                            )}
                        </Row>
                        <AmountInput
                            amount={amount}
                            locked={
                                lnurl && lnurl.minSendable === lnurl.maxSendable
                                    ? true
                                    : false
                            }
                            onAmountChange={(
                                amount: string,
                                satAmount: string | number
                            ) => {
                                this.setState({
                                    amount,
                                    satAmount
                                });
                            }}
                        />
                        {lnurl.commentAllowed > 0 ? (
                            <>
                                <Text
                                    style={{
                                        ...styles.text,
                                        marginTop: 10,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.LnurlPay.LnurlPay.comment'
                                    ) + ` (${lnurl.commentAllowed} char)`}
                                    :
                                </Text>
                                <TextInput
                                    value={comment}
                                    onChangeText={(text: string) => {
                                        this.setState({ comment: text });
                                    }}
                                    style={styles.textInput}
                                />
                            </>
                        ) : null}
                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.LnurlPay.LnurlPay.confirm'
                                )}
                                titleStyle={{
                                    color: themeColor('text')
                                }}
                                icon={{
                                    name: 'send',
                                    size: 25,
                                    color: themeColor('text')
                                }}
                                onPress={() => {
                                    this.sendValues(satAmount);
                                }}
                                style={styles.button}
                                buttonStyle={{
                                    backgroundColor: themeColor('secondary'),
                                    borderRadius: 30
                                }}
                            />
                        </View>
                    </View>
                    <View style={styles.metadata}>
                        <LnurlPayMetadata metadata={lnurl.metadata} />
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'Lato-Regular'
    },
    textInput: { paddingVertical: 10 },
    content: { paddingHorizontal: 20 },
    button: { paddingVertical: 15 },
    metadata: { padding: 20 }
});
