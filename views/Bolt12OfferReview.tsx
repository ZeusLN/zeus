import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Amount from '../components/Amount';
import Button from '../components/Button';
import Conversion from '../components/Conversion';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';
import SwipeButton from '../components/SwipeButton';
import {
    ErrorMessage,
    WarningMessage
} from '../components/SuccessErrorMessage';

import SettingsStore, {
    DEFAULT_SLIDE_TO_PAY_THRESHOLD
} from '../stores/SettingsStore';
import TransactionsStore from '../stores/TransactionsStore';

import type { DecodedOffer } from '../ldknode/LdkNodeInjection';

import DateTimeUtils from '../utils/DateTimeUtils';
import FeeUtils from '../utils/FeeUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface Bolt12OfferReviewProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<
        'Bolt12OfferReview',
        {
            offer: string;
            decodedOffer: DecodedOffer;
            satAmount: string;
            timeoutSeconds?: string;
            feeLimitSat?: string;
        }
    >;
    SettingsStore: SettingsStore;
    TransactionsStore: TransactionsStore;
}

interface Bolt12OfferReviewState {
    swipeButtonKey: number;
}

@inject('SettingsStore', 'TransactionsStore')
@observer
export default class Bolt12OfferReview extends React.Component<
    Bolt12OfferReviewProps,
    Bolt12OfferReviewState
> {
    private focusListener: any;

    state = {
        swipeButtonKey: 0
    };

    componentDidMount() {
        // Reset the slide-to-pay slider position when the screen regains
        // focus, e.g. after backing out of a failed payment to retry
        const { navigation } = this.props;
        this.focusListener = navigation.addListener('focus', () => {
            this.setState({
                swipeButtonKey: this.state.swipeButtonKey + 1
            });
        });
    }

    componentWillUnmount() {
        if (this.focusListener) this.focusListener();
    }

    getFeeLimitSat = (): string => {
        const { route } = this.props;
        const { feeLimitSat, satAmount } = route.params;
        return (
            feeLimitSat ||
            FeeUtils.calculateDefaultRoutingFee(Number(satAmount)).toString()
        );
    };

    payOffer = () => {
        const { TransactionsStore, navigation, route } = this.props;
        const { offer, satAmount, timeoutSeconds } = route.params;

        // Guard against double-submission: bail if a payment is already in
        // flight so a rapid double-tap or re-fired swipe can't dispatch twice
        if (TransactionsStore.paymentInFlight) return;

        TransactionsStore.sendPayment({
            offer,
            amount: satAmount,
            fee_limit_sat: this.getFeeLimitSat(),
            timeout_seconds: timeoutSeconds
        });

        navigation.navigate('SendingLightning');
    };

    render() {
        const { navigation, route, SettingsStore, TransactionsStore } =
            this.props;
        const { decodedOffer, satAmount } = route.params;
        const { settings } = SettingsStore;

        const slideToPayThreshold =
            settings?.payments?.slideToPayThreshold ??
            DEFAULT_SLIDE_TO_PAY_THRESHOLD;

        const isExpired = decodedOffer.isExpired;
        const offerAmountSats =
            decodedOffer.amountType === 'bitcoin' && decodedOffer.amountMsats
                ? Math.ceil(decodedOffer.amountMsats / 1000)
                : undefined;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Bolt12OfferReview.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView style={styles.content}>
                    {isExpired && (
                        <ErrorMessage
                            message={localeString(
                                'views.Bolt12OfferReview.expired'
                            )}
                        />
                    )}
                    {decodedOffer.expectsQuantity && (
                        <WarningMessage
                            message={localeString(
                                'views.Bolt12OfferReview.expectsQuantity'
                            )}
                        />
                    )}
                    {decodedOffer.amountType === 'currency' && (
                        <WarningMessage
                            message={`${localeString(
                                'views.Bolt12OfferReview.currencyDenominated'
                            )}: ${decodedOffer.currencyAmount} ${
                                decodedOffer.iso4217Code
                            }`}
                        />
                    )}
                    <View style={styles.center}>
                        <Amount sats={satAmount} jumboText toggleable />
                        <View style={{ top: 10 }}>
                            <Conversion sats={satAmount} />
                        </View>
                    </View>
                    <View style={{ marginTop: 20 }}>
                        {decodedOffer.description && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.PaymentRequest.description'
                                )}
                                value={decodedOffer.description}
                            />
                        )}
                        {decodedOffer.issuer && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Bolt12OfferReview.issuer'
                                )}
                                value={decodedOffer.issuer}
                            />
                        )}
                        {decodedOffer.issuerSigningPubkey && (
                            <KeyValue
                                keyValue={localeString('general.destination')}
                                value={decodedOffer.issuerSigningPubkey}
                                sensitive
                            />
                        )}
                        {offerAmountSats && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Bolt12OfferReview.offerAmount'
                                )}
                                value={
                                    <Amount sats={offerAmountSats} toggleable />
                                }
                            />
                        )}
                        {decodedOffer.absoluteExpirySeconds && (
                            <KeyValue
                                keyValue={localeString('general.expiresOn')}
                                value={DateTimeUtils.listFormattedDate(
                                    decodedOffer.absoluteExpirySeconds
                                )}
                            />
                        )}
                        <KeyValue
                            keyValue={`${localeString(
                                'views.PaymentRequest.feeLimit'
                            )} (${localeString('general.sats')})`}
                            value={this.getFeeLimitSat()}
                        />
                    </View>
                </ScrollView>
                <View style={{ bottom: 10 }}>
                    {Number(satAmount) >= slideToPayThreshold ? (
                        <SwipeButton
                            key={this.state.swipeButtonKey}
                            onSwipeSuccess={this.payOffer}
                            disabled={
                                isExpired || TransactionsStore.paymentInFlight
                            }
                            instructionText={localeString(
                                'views.PaymentRequest.slideToPay'
                            )}
                            containerStyle={{
                                backgroundColor: themeColor('secondaryText')
                            }}
                            swipeButtonStyle={{
                                backgroundColor: themeColor('text')
                            }}
                        />
                    ) : (
                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.Bolt12OfferReview.payOffer'
                                )}
                                icon={{
                                    name: 'send',
                                    size: 25
                                }}
                                onPress={this.payOffer}
                                disabled={
                                    isExpired ||
                                    TransactionsStore.paymentInFlight
                                }
                            />
                        </View>
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: 20
    },
    center: {
        alignItems: 'center',
        marginTop: 20
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    }
});
