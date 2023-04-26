import * as React from 'react';
import EncryptedStorage from 'react-native-encrypted-storage';
import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Amount from '../components/Amount';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';

import Payment from '../models/Payment';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import LnurlPayStore from '../stores/LnurlPayStore';

import LnurlPayHistorical from './LnurlPay/Historical';

import EditNotes from '../assets/images/SVG/Pen.svg';

interface PaymentProps {
    navigation: any;
    LnurlPayStore: LnurlPayStore;
}

@inject('LnurlPayStore')
@observer
export default class PaymentView extends React.Component<PaymentProps> {
    state = {
        lnurlpaytx: null,
        storedNotes: ''
    };

    async componentDidMount() {
        const { navigation, LnurlPayStore } = this.props;
        const payment: Payment = navigation.getParam('payment', null);
        const lnurlpaytx = await LnurlPayStore.load(payment.payment_hash);
        if (lnurlpaytx) {
            this.setState({ lnurlpaytx });
        }
        EncryptedStorage.getItem('note-' + payment.payment_hash)
            .then((storedNotes) => {
                this.setState({ storedNotes });
            })
            .catch((error) => {
                console.error('Error retrieving notes:', error);
            });
    }

    render() {
        const { navigation } = this.props;
        const { storedNotes } = this.state;

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

        const lnurlpaytx = this.state.lnurlpaytx;

        const EditNotesButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('AddNotes', { payment_hash })
                }
                style={{ marginTop: -12 }}
            >
                <EditNotes height={40} width={40} />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Payment.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    rightComponent={<EditNotesButton />}
                    navigation={navigation}
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

                        {enhancedPath.length > 0 && (
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: 'transparent',
                                    marginLeft: -16,
                                    marginRight: -16
                                }}
                                onPress={() =>
                                    navigation.navigate('PaymentPaths', {
                                        enhancedPath
                                    })
                                }
                            >
                                <ListItem.Content>
                                    <ListItem.Title
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'Lato-Regular'
                                        }}
                                    >
                                        {enhancedPath.length > 1
                                            ? `${localeString(
                                                  'views.Payment.paths'
                                              )} (${enhancedPath.length})`
                                            : localeString(
                                                  'views.Payment.path'
                                              )}
                                    </ListItem.Title>
                                </ListItem.Content>
                                <Icon
                                    name="keyboard-arrow-right"
                                    color={themeColor('secondaryText')}
                                />
                            </ListItem>
                        )}
                        {storedNotes && (
                            <KeyValue
                                keyValue={localeString('views.Payment.notes')}
                                value={storedNotes}
                                sensitive
                            />
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
