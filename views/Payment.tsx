import * as React from 'react';
import {
    StyleSheet,
    ScrollView,
    View,
    Text,
    TouchableOpacity
} from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { Row } from '../components/layout/Row';
import Amount from '../components/Amount';
import Button from '../components/Button';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';

import Payment from '../models/Payment';

import LnurlPayStore, { LnurlPayTransaction } from '../stores/LnurlPayStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import SettingsStore from '../stores/SettingsStore';

import LnurlPayHistorical from './LnurlPay/Historical';

import EditNotes from '../assets/images/SVG/Pen.svg';
import QR from '../assets/images/SVG/QR.svg';

interface PaymentProps {
    navigation: StackNavigationProp<any, any>;
    LnurlPayStore?: LnurlPayStore;
    NodeInfoStore?: NodeInfoStore;
    SettingsStore?: SettingsStore;
    route: Route<'Payment', { payment: Payment }>;
}

interface PaymentState {
    lnurlpaytx: LnurlPayTransaction | null;
    storedNote: string;
}

@inject('LnurlPayStore', 'NodeInfoStore', 'SettingsStore')
@observer
export default class PaymentView extends React.Component<
    PaymentProps,
    PaymentState
> {
    state = {
        lnurlpaytx: null,
        storedNote: ''
    };

    async componentDidMount() {
        const { navigation, LnurlPayStore, route } = this.props;
        const payment = route.params?.payment;
        const lnurlpaytx = payment.paymentHash
            ? await LnurlPayStore!.load(payment.paymentHash)
            : undefined;
        if (lnurlpaytx) {
            this.setState({ lnurlpaytx });
        }
        this.getNote();
        navigation.addListener('focus', () => {
            this.getNote();
        });
    }

    getNote = () => {
        const { route } = this.props;
        const payment = route.params?.payment;
        const note = payment.getNote;
        this.setState({ storedNote: note });
    };

    render() {
        const { navigation, SettingsStore, NodeInfoStore, route } = this.props;
        const { storedNote, lnurlpaytx } = this.state;
        const { testnet } = NodeInfoStore!;

        const payment = route.params?.payment;
        const formattedOriginalTimeUntilExpiry =
            payment.getFormattedOriginalTimeUntilExpiry(
                SettingsStore!.settings.locale
            );
        const {
            getDisplayTime,
            getFee,
            getFeePercentage,
            paymentHash,
            getPreimage,
            getDestination,
            enhancedPath,
            getKeysendMessage,
            getMemo,
            isIncomplete,
            isInTransit,
            isFailed,
            getNoteKey,
            getPaymentRequest
        } = payment;
        const date = getDisplayTime;

        const EditNotesButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('AddNotes', {
                        noteKey: getNoteKey
                    })
                }
                style={{ marginRight: 15 }}
            >
                <EditNotes
                    style={{ alignSelf: 'center' }}
                    fill={themeColor('text')}
                />
            </TouchableOpacity>
        );

        const QRButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('QR', {
                        value: `lightning:${getPaymentRequest}`
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
                        text: isFailed
                            ? localeString('views.Payment.failedPayment')
                            : isInTransit
                            ? localeString('views.Payment.inTransitPayment')
                            : localeString('views.Payment.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <Row>
                            <EditNotesButton />
                            {!!getPaymentRequest && <QRButton />}
                        </Row>
                    }
                    navigation={navigation}
                />
                <ScrollView keyboardShouldPersistTaps="handled">
                    <View style={styles.center}>
                        <Amount
                            sats={payment.getAmount}
                            debit
                            jumboText
                            sensitive
                            toggleable
                            pending={isInTransit}
                        />
                    </View>

                    {lnurlpaytx && (
                        <View style={styles.historical}>
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
                                    <Row>
                                        <Amount
                                            sats={getFee}
                                            debit
                                            sensitive
                                            toggleable
                                        />
                                        {getFeePercentage && (
                                            <Text
                                                style={{
                                                    fontFamily:
                                                        'PPNeueMontreal-Book',
                                                    color: themeColor('text')
                                                }}
                                            >
                                                {` (${getFeePercentage})`}
                                            </Text>
                                        )}
                                    </Row>
                                }
                            />
                        )}

                        {getKeysendMessage && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoices.keysendMessage'
                                )}
                                value={getKeysendMessage}
                                sensitive
                            />
                        )}

                        {getMemo && (
                            <KeyValue
                                keyValue={localeString('views.Invoice.memo')}
                                value={getMemo}
                                sensitive
                            />
                        )}

                        {getDestination && (
                            <KeyValue
                                keyValue={localeString('general.destination')}
                                value={getDestination}
                                sensitive
                                color={themeColor('highlight')}
                                mempoolLink={() =>
                                    UrlUtils.goToBlockExplorerPubkey(
                                        getDestination,
                                        testnet
                                    )
                                }
                            />
                        )}

                        {paymentHash && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Payment.paymentHash'
                                )}
                                value={paymentHash}
                                sensitive
                            />
                        )}

                        {getPreimage && !isIncomplete && (
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

                        {formattedOriginalTimeUntilExpiry && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.originalExpiration'
                                )}
                                value={formattedOriginalTimeUntilExpiry}
                                sensitive
                            />
                        )}

                        {enhancedPath.length > 0 && enhancedPath[0][0] && (
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
                                            fontFamily: 'PPNeueMontreal-Book'
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
                        {storedNote && (
                            <KeyValue
                                keyValue={localeString('general.note')}
                                value={storedNote}
                                sensitive
                                mempoolLink={() =>
                                    navigation.navigate('AddNotes', {
                                        noteKey: getNoteKey
                                    })
                                }
                            />
                        )}
                    </View>
                </ScrollView>
                <View style={{ bottom: 15 }}>
                    {getNoteKey && (
                        <Button
                            title={
                                storedNote
                                    ? localeString(
                                          'views.SendingLightning.UpdateNote'
                                      )
                                    : localeString(
                                          'views.SendingLightning.AddANote'
                                      )
                            }
                            onPress={() =>
                                navigation.navigate('AddNotes', {
                                    noteKey: getNoteKey
                                })
                            }
                            containerStyle={{ marginTop: 15 }}
                            noUppercase
                        />
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    historical: {
        padding: 20
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    }
});
