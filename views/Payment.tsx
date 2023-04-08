import * as React from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Amount from '../components/Amount';
import KeyValue from '../components/KeyValue';
import PaymentPath from '../components/PaymentPath';
import Screen from '../components/Screen';

import Payment from '../models/Payment';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import LnurlPayStore from '../stores/LnurlPayStore';

import LnurlPayHistorical from './LnurlPay/Historical';

interface PaymentProps {
    navigation: any;
    LnurlPayStore: LnurlPayStore;
}

@inject('LnurlPayStore')
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
        const { navigation } = this.props;

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
            <Screen>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Payment.title'),
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
                <ScrollView>
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
                                keyValue={localeString(
                                    'views.Payment.paymentHash'
                                )}
                                value={payment_hash}
                                sensitive
                            />
                        )}

                        {getPreimage && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Payment.paymentPreimage'
                                )}
                                value={getPreimage}
                                sensitive
                            />
                        )}

                        {date && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Payment.creationDate'
                                )}
                                value={date}
                                sensitive
                            />
                        )}

                        <ListItem
                            containerStyle={{
                                borderBottomWidth: 0,
                                backgroundColor: 'transparent',
                                marginLeft: -16,
                                marginRight: -16
                            }}
                            onPress={() => console.log('a')}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'Lato-Regular'
                                    }}
                                >
                                    {enhancedPath.length > 1
                                        ? 'Paths'
                                        : localeString('views.Payment.path')}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>

                        {enhancedPath.length > 0 && (
                            <>
                                <KeyValue
                                    keyValue={
                                        enhancedPath.length > 1
                                            ? 'Paths'
                                            : localeString('views.Payment.path')
                                    }
                                />
                                <PaymentPath value={enhancedPath} />
                            </>
                        )}
                    </View>
                </ScrollView>
            </Screen>
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
