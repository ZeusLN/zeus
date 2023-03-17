import url from 'url';
import * as React from 'react';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Header, Icon } from 'react-native-elements';
import querystring from 'querystring-es3';

import Amount from './../../components/Amount';
import Button from './../../components/Button';
import Screen from './../../components/Screen';
import TextInput from '../../components/TextInput';
import { Row } from '../../components/layout/Row';

import InvoicesStore from '../../stores/InvoicesStore';
import LnurlPayStore from '../../stores/LnurlPayStore';
import SettingsStore from '../../stores/SettingsStore';
import FiatStore from '../../stores/FiatStore';
import UnitsStore, { SATS_PER_BTC } from '../../stores/UnitsStore';

import LnurlPayMetadata from './Metadata';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface LnurlPayProps {
    navigation: any;
    InvoicesStore: InvoicesStore;
    LnurlPayStore: LnurlPayStore;
    FiatStore: FiatStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

interface LnurlPayState {
    amount: string;
    domain: string;
    comment: string;
}

@inject(
    'FiatStore',
    'InvoicesStore',
    'SettingsStore',
    'LnurlPayStore',
    'UnitsStore'
)
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

                InvoicesStore.getPayReq(pr, lnurl.metadata).then(() => {
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
                        successAction
                    );
                    navigation.navigate('PaymentRequest');
                });
            });
    }

    render() {
        const { navigation, SettingsStore, UnitsStore, FiatStore } = this.props;
        const { amount, domain, comment } = this.state;
        const { settings } = SettingsStore;
        const { fiat } = settings;
        const { units, changeUnits } = UnitsStore;
        const { fiatRates, getSymbol } = FiatStore;

        const fiatEntry =
            fiat && fiatRates && fiatRates.filter
                ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
                : null;

        const rate =
            fiat && fiat !== 'Disabled' && fiatRates && fiatEntry
                ? fiatEntry.rate
                : 0;

        let satAmount: string | number;
        switch (units) {
            case 'sats':
                satAmount = amount;
                break;
            case 'BTC':
                satAmount = Number(amount) * SATS_PER_BTC;
                break;
            case 'fiat':
                satAmount = Number(
                    (Number(amount.replace(/,/g, '.')) / Number(rate)) *
                        Number(SATS_PER_BTC)
                ).toFixed(0);
                break;
        }

        const lnurl = navigation.getParam('lnurlParams');

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <Screen>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: 'Send',
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor="transparent"
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
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
                                    sats={Math.ceil(lnurl.minSendable / 1000)}
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
                                    sats={Math.floor(lnurl.maxSendable / 1000)}
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
                    <TextInput
                        value={amount}
                        onChangeText={(text: string) => {
                            this.setState({ amount: text });
                        }}
                        locked={
                            lnurl && lnurl.minSendable === lnurl.maxSendable
                                ? true
                                : false
                        }
                        style={styles.textInput}
                        prefix={
                            units !== 'sats' &&
                            (units === 'BTC'
                                ? '₿'
                                : !getSymbol().rtl
                                ? getSymbol().symbol
                                : null)
                        }
                        suffix={
                            units === 'sats'
                                ? units
                                : getSymbol().rtl &&
                                  units === 'fiat' &&
                                  getSymbol().symbol
                        }
                        toggleUnits={changeUnits}
                    />
                    {units !== 'sats' && (
                        <Amount sats={satAmount} fixedUnits="sats" toggleable />
                    )}
                    {units !== 'BTC' && (
                        <Amount sats={satAmount} fixedUnits="BTC" toggleable />
                    )}
                    {units === 'fiat' && (
                        <TouchableOpacity onPress={() => changeUnits()}>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('text')
                                }}
                            >
                                {FiatStore.getRate()}
                            </Text>
                        </TouchableOpacity>
                    )}
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
<<<<<<< Updated upstream
                            title="Confirm"
=======
                            title={localeString('general.confirm')}
>>>>>>> Stashed changes
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
                            buttonStyle={{
                                backgroundColor: themeColor('secondary'),
                                borderRadius: 30
                            }}
                        />
                    </View>
                </View>
                <View style={styles.content}>
                    <LnurlPayMetadata metadata={lnurl.metadata} />
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'Lato-Regular'
    },
    textInput: {
        paddingTop: 10,
        paddingBottom: 10
    },
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    }
});
