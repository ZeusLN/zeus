import * as React from 'react';
import { inject } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { ScrollView } from 'react-native-gesture-handler';
import { StackNavigationProp } from '@react-navigation/stack';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';

import Amount from '../components/Amount';
import Button from '../components/Button';
import Screen from '../components/Screen';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import { Row } from '../components/layout/Row';
import LoadingIndicator from '../components/LoadingIndicator';

import InvoicesStore from '../stores/InvoicesStore';

import WithdrawalRequest from '../models/WithdrawalRequest';

import QR from '../assets/images/SVG/QR.svg';

interface WithdrawalRequestInfoProps {
    InvoicesStore: InvoicesStore;
    navigation: StackNavigationProp<any, any>;
    route: Route<'WithdrawalRequestInfo', { bolt12: string }>;
}

interface WithdrawalRequestInfoState {
    withdrawalReqResult: WithdrawalRequest | null;
    loading: boolean;
}

@inject('InvoicesStore')
export default class WithdrawalRequestInfo extends React.Component<
    WithdrawalRequestInfoProps,
    WithdrawalRequestInfoState
> {
    state: WithdrawalRequestInfoState = {
        withdrawalReqResult: null,
        loading: false
    };

    handleRedemption = async ({
        invreq,
        label
    }: {
        invreq: string;
        label: string;
    }) => {
        const { navigation } = this.props;
        const uniqueLabel = `${label}-${Date.now()}`;

        navigation.navigate('RedeemWithdrawalRequest', {
            invreq,
            label: uniqueLabel
        });
    };

    async componentDidMount() {
        const { route, InvoicesStore } = this.props;
        const { bolt12 } = route.params;
        this.setState({ loading: true });
        await InvoicesStore.getWithdrawalReq(bolt12);
        this.setState({
            withdrawalReqResult: InvoicesStore.withdrawal_req,
            loading: false
        });
    }

    render() {
        const { navigation, route } = this.props;
        const { loading } = this.state;
        const { bolt12 } = route.params;
        const { withdrawalReqResult } = this.state;

        const QRButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('QR', {
                        value: bolt12,
                        satAmount:
                            Number(
                                withdrawalReqResult?.invreq_amount_msat ?? 0
                            ) / 1000
                    })
                }
            >
                <QR fill={themeColor('text')} style={{ alignSelf: 'center' }} />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('general.withdrawalRequest'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <Row>
                            <QRButton />
                        </Row>
                    }
                    navigation={navigation}
                />
                {loading && <LoadingIndicator />}
                {!loading && (
                    <>
                        <ScrollView keyboardShouldPersistTaps="handled">
                            <View style={styles.amount}>
                                <Amount
                                    sats={(
                                        Number(
                                            withdrawalReqResult?.invreq_amount_msat
                                        ) / 1000
                                    ).toString()}
                                    sensitive
                                    jumboText
                                    toggleable
                                />
                            </View>

                            <View style={styles.content}>
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.description'
                                    )}
                                    value={
                                        withdrawalReqResult?.offer_description
                                    }
                                    sensitive
                                    color={themeColor('text')}
                                />
                            </View>

                            <View style={styles.content}>
                                <KeyValue
                                    keyValue={localeString('general.valid')}
                                    value={
                                        withdrawalReqResult?.valid
                                            ? localeString('general.true')
                                            : localeString('general.false')
                                    }
                                    sensitive
                                    color={themeColor('text')}
                                />
                            </View>

                            <View style={styles.content}>
                                <KeyValue
                                    keyValue={localeString('general.signature')}
                                    value={withdrawalReqResult?.signature}
                                    sensitive
                                    color={themeColor('text')}
                                />
                            </View>

                            <View style={styles.content}>
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PayCode.bolt12'
                                    )}
                                    value={bolt12}
                                    sensitive
                                    color={themeColor('text')}
                                />
                            </View>
                        </ScrollView>
                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.Settings.LightningAddressInfo.redeem'
                                )}
                                icon={{
                                    name: 'send',
                                    size: 25
                                }}
                                onPress={() =>
                                    this.handleRedemption({
                                        invreq: bolt12,
                                        label:
                                            withdrawalReqResult?.offer_description ??
                                            ''
                                    })
                                }
                            />
                        </View>
                    </>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    amount: {
        alignItems: 'center',
        paddingVertical: 15
    },
    button: {
        alignItems: 'center',
        marginBottom: 20
    }
});
