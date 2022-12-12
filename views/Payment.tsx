import * as React from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Amount from './../components/Amount';
import KeyValue from './../components/KeyValue';

import Payment from './../models/Payment';
import PrivacyUtils from './../utils/PrivacyUtils';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import SettingsStore from './../stores/SettingsStore';
import LnurlPayStore from './../stores/LnurlPayStore';
import LnurlPayHistorical from './LnurlPay/Historical';

interface PaymentProps {
    navigation: any;
    SettingsStore: SettingsStore;
    LnurlPayStore: LnurlPayStore;
}

@inject('SettingsStore', 'LnurlPayStore')
@observer
export default class PaymentView extends React.Component<PaymentProps> {
    state = {
        lnurlpaytx: null
    };

    async componentDidMount() {
        const { navigation, LnurlPayStore } = this.props;
        const payment: Payment = navigation.getParam('payment', null);
        const lnurlpaytx = await LnurlPayStore.load(payment.payment_hash);
        if (lnurlpaytx) {
            this.setState({ lnurlpaytx });
        }
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const { privacy } = settings;
        const lurkerMode = (privacy && privacy.lurkerMode) || false;

        const payment: Payment = navigation.getParam('payment', null);
        const {
            getDisplayTime,
            getFee,
            payment_hash,
            getPreimage,
            enhancedPath,
            getMemo
        } = payment;
        const date = getDisplayTime;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        const lnurlpaytx = this.state.lnurlpaytx;

        return (
            <ScrollView
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Payment.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <View style={styles.center}>
                    <Amount
                        sats={payment.getAmount}
                        debit
                        jumboText
                        sensitive
                        toggleable
                    />
                </View>

                {lnurlpaytx && (
                    <View style={styles.content}>
                        <LnurlPayHistorical
                            navigation={navigation}
                            lnurlpaytx={lnurlpaytx}
                            preimage={getPreimage}
                        />
                    </View>
                )}

                <View style={styles.content}>
                    {getFee && (
                        <KeyValue
                            keyValue={localeString('views.Payment.fee')}
                            value={
                                <Amount
                                    sats={getFee}
                                    debit
                                    sensitive
                                    toggleable
                                />
                            }
                            toggleable
                        />
                    )}

                    {getMemo && (
                        <KeyValue
                            keyValue={localeString('views.Receive.memo')}
                            value={getMemo}
                            sensitive
                        />
                    )}

                    {typeof payment_hash === 'string' && (
                        <KeyValue
                            keyValue={localeString('views.Payment.paymentHash')}
                            value={payment_hash}
                            sensitive
                        />
                    )}

                    <KeyValue
                        keyValue={localeString('views.Payment.paymentPreimage')}
                        value={getPreimage}
                        sensitive
                    />

                    <KeyValue
                        keyValue={localeString('views.Payment.creationDate')}
                        value={date}
                        sensitive
                    />

                    {enhancedPath.length > 0 && (
                        <KeyValue
                            keyValue={localeString('views.Payment.path')}
                            value={
                                lurkerMode
                                    ? PrivacyUtils.sensitiveValue(
                                          enhancedPath.join(', ')
                                      )
                                    : `${enhancedPath}`
                            }
                            sensitive
                        />
                    )}
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
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
