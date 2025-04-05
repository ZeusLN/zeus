import * as React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import { inject } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import CashuStore from '../../stores/CashuStore';
import SettingsStore from '../../stores/SettingsStore';
import stores from '../../stores/Stores';

import Amount from '../../components/Amount';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import { Row } from '../../components/layout/Row';

import CashuInvoice from '../../models/CashuInvoice';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import EditNotes from '../../assets/images/SVG/Pen.svg';
import QR from '../../assets/images/SVG/QR.svg';

interface CashuInvoiceProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore?: CashuStore;
    SettingsStore?: SettingsStore;
    route: Route<'CashuInvoice', { invoice: CashuInvoice }>;
}

interface CashuInvoiceState {
    updatedInvoice?: any;
    storedNote: string;
}

@inject('CashuStore', 'SettingsStore')
export default class CashuInvoiceView extends React.Component<
    CashuInvoiceProps,
    CashuInvoiceState
> {
    state = {
        updatedInvoice: undefined,
        storedNote: ''
    };

    async componentDidMount() {
        const { CashuStore, navigation, route } = this.props;
        const { checkInvoicePaid, initializeWallet, cashuWallets } =
            CashuStore!!;
        const invoice = route.params?.invoice;
        const { mintUrl, quote, getNote, isPaid } = invoice;

        navigation.addListener('focus', () => {
            const note = getNote;
            this.setState({ storedNote: note });
        });

        if (!isPaid) {
            console.log('invoice not paid last time checked, checking...', {
                quote,
                mint: mintUrl
            });

            if (!cashuWallets[mintUrl].wallet) {
                await initializeWallet(mintUrl, true);
            }

            // Set up a periodic check every 5 seconds
            const checkInterval = setInterval(async () => {
                const result = await checkInvoicePaid(quote, mintUrl);

                if (result?.isPaid) {
                    console.log('Invoice paid, stopping check...');
                    this.setState({
                        updatedInvoice: result?.updatedInvoice
                    });
                    clearInterval(checkInterval); // Stop checking once paid
                    stores.activityStore.getActivityAndFilter(
                        stores.settingsStore.settings.locale
                    );
                } else {
                    console.log('Invoice not paid, checking again...');
                }
            }, 5000);
        }
    }

    render() {
        const { navigation, SettingsStore, route } = this.props;
        const { updatedInvoice, storedNote } = this.state;
        const invoice = updatedInvoice || route.params?.invoice;
        const locale = SettingsStore?.settings.locale;
        invoice.determineFormattedOriginalTimeUntilExpiry(locale);
        invoice.determineFormattedRemainingTimeUntilExpiry(locale);
        const {
            isPaid,
            getMemo,
            formattedCreationDate,
            formattedOriginalTimeUntilExpiry,
            formattedTimeUntilExpiry,
            getPaymentRequest,
            getNoteKey,
            getAmount,
            mintUrl
        } = invoice;

        const QRButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('QR', {
                        value: `lightning:${getPaymentRequest}`,
                        satAmount: getAmount
                    })
                }
            >
                <QR fill={themeColor('text')} style={{ alignSelf: 'center' }} />
            </TouchableOpacity>
        );
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
                    fill={themeColor('text')}
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.CashuInvoice.title'),
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
                            sats={invoice.getAmount}
                            sensitive
                            jumboText
                            toggleable
                            pending={!invoice.isExpired && !invoice.isPaid}
                            credit={invoice.isPaid}
                        />
                    </View>

                    <View style={styles.content}>
                        {mintUrl && (
                            <KeyValue
                                keyValue={localeString('cashu.mintUrl')}
                                value={mintUrl}
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

                        {isPaid && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.settleDate'
                                )}
                                value={invoice.formattedSettleDate}
                                sensitive
                            />
                        )}

                        {formattedCreationDate && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.creationDate'
                                )}
                                value={formattedCreationDate}
                                sensitive
                            />
                        )}

                        {!!formattedOriginalTimeUntilExpiry && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.originalExpiration'
                                )}
                                value={formattedOriginalTimeUntilExpiry}
                                sensitive
                            />
                        )}

                        {!!formattedTimeUntilExpiry && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.expiration'
                                )}
                                value={formattedTimeUntilExpiry}
                                sensitive
                            />
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
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    }
});
