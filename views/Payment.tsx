import * as React from 'react';
import EncryptedStorage from 'react-native-encrypted-storage';
import {
    StyleSheet,
    ScrollView,
    View,
    Text,
    TouchableOpacity
} from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

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

import LnurlPayStore from '../stores/LnurlPayStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import SettingsStore from '../stores/SettingsStore';

import LnurlPayHistorical from './LnurlPay/Historical';

import EditNotes from '../assets/images/SVG/Pen.svg';

interface PaymentProps {
    navigation: any;
    LnurlPayStore?: LnurlPayStore;
    NodeInfoStore?: NodeInfoStore;
    SettingsStore?: SettingsStore;
}

@inject('LnurlPayStore', 'NodeInfoStore', 'SettingsStore')
@observer
export default class PaymentView extends React.Component<PaymentProps> {
    state = {
        lnurlpaytx: null,
        storedNotes: ''
    };

    async componentDidMount() {
        const { navigation, LnurlPayStore } = this.props;
        const payment: Payment = navigation.getParam('payment', null);
        const lnurlpaytx = payment.paymentHash
            ? await LnurlPayStore!.load(payment.paymentHash)
            : undefined;
        if (lnurlpaytx) {
            this.setState({ lnurlpaytx });
        }
        navigation.addListener('didFocus', () => {
            const noteKey =
                payment.paymentHash ?? typeof payment.getPreimage === 'string'
                    ? payment.getPreimage
                    : null;

            EncryptedStorage.getItem('note-' + noteKey)
                .then((storedNotes) => {
                    this.setState({ storedNotes });
                })
                .catch((error) => {
                    console.error('Error retrieving notes:', error);
                });
        });
    }

    render() {
        const { navigation, SettingsStore, NodeInfoStore } = this.props;
        const { storedNotes, lnurlpaytx } = this.state;
        const { testnet } = NodeInfoStore;

        const payment: Payment = navigation.getParam('payment', null);
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
            getMemo,
            isIncomplete,
            isInTransit,
            isFailed
        } = payment;
        const date = getDisplayTime;
        const noteKey =
            paymentHash ?? typeof getPreimage === 'string' ? getPreimage : null;
        const EditNotesButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('AddNotes', { payment_hash: noteKey })
                }
            >
                <EditNotes
                    style={{ alignSelf: 'center' }}
                    fill={themeColor('text')}
                />
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
                    rightComponent={<EditNotesButton />}
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

                        {getDestination && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Payment.destination'
                                )}
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
                        {storedNotes && (
                            <KeyValue
                                keyValue={localeString('views.Payment.notes')}
                                value={storedNotes}
                                sensitive
                                mempoolLink={() =>
                                    navigation.navigate('AddNotes', {
                                        payment_hash: noteKey
                                    })
                                }
                            />
                        )}
                        {noteKey && (
                            <Button
                                title={
                                    storedNotes
                                        ? localeString(
                                              'views.SendingLightning.UpdateNote'
                                          )
                                        : localeString(
                                              'views.SendingLightning.AddANote'
                                          )
                                }
                                onPress={() =>
                                    navigation.navigate('AddNotes', {
                                        payment_hash: noteKey
                                    })
                                }
                                containerStyle={{ marginTop: 15 }}
                                secondary
                                noUppercase
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
    historical: {
        padding: 20
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    }
});
