import * as React from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { LNURLWithdrawParams } from 'js-lnurl';
import { ButtonGroup, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Success from '../assets/images/GIF/Success.gif';

import { Amount } from './../components/Amount';
import Button from './../components/Button';
import CollapsedQR from './../components/CollapsedQR';
import LoadingIndicator from './../components/LoadingIndicator';
import {
    SuccessMessage,
    ErrorMessage
} from './../components/SuccessErrorMessage';
import TextInput from './../components/TextInput';

import FiatStore from './../stores/FiatStore';
import InvoicesStore from './../stores/InvoicesStore';
import SettingsStore from './../stores/SettingsStore';
import UnitsStore, { satoshisPerBTC } from './../stores/UnitsStore';

import { localeString } from './../utils/LocaleUtils';
import RESTUtils from './../utils/RESTUtils';
import { themeColor } from './../utils/ThemeUtils';

interface ReceiveProps {
    exitSetup: any;
    navigation: any;
    InvoicesStore: InvoicesStore;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
    FiatStore: FiatStore;
}

interface ReceiveState {
    selectedIndex: number;
    memo: string;
    value: string;
    expiry: string;
    ampInvoice: boolean;
    routeHints: boolean;
}

@inject('InvoicesStore', 'SettingsStore', 'UnitsStore', 'FiatStore')
@observer
export default class Receive extends React.Component<
    ReceiveProps,
    ReceiveState
> {
    state = {
        selectedIndex: 0,
        memo: '',
        value: '',
        expiry: '3600',
        ampInvoice: false,
        routeHints: false
    };

    componentDidMount() {
        const { navigation, InvoicesStore } = this.props;
        const { reset } = InvoicesStore;

        reset();
        const lnurl: LNURLWithdrawParams | undefined =
            navigation.getParam('lnurlParams');

        const selectedIndex: number = navigation.getParam('selectedIndex');

        if (lnurl) {
            this.setState({
                selectedIndex: 0,
                memo: lnurl.defaultDescription,
                value: Math.floor(lnurl.maxWithdrawable / 1000).toString()
            });
        }

        if (selectedIndex) {
            this.setState({
                selectedIndex
            });
        }
    }

    getNewAddress = () => {
        const { InvoicesStore } = this.props;
        InvoicesStore.getNewAddress();
    };

    updateIndex = (selectedIndex: number) => {
        const { InvoicesStore } = this.props;

        this.setState({
            selectedIndex,
            // reset LN invoice values so old invoices don't linger
            memo: '',
            value: '',
            expiry: '3600'
        });

        if (InvoicesStore.payment_request) {
            InvoicesStore.resetPaymentReq();
        }
    };

    render() {
        const {
            InvoicesStore,
            SettingsStore,
            UnitsStore,
            FiatStore,
            navigation
        } = this.props;
        const { selectedIndex, memo, value, expiry, ampInvoice, routeHints } =
            this.state;
        const { units, changeUnits, getAmount } = UnitsStore;
        const { fiatRates, getSymbol }: any = FiatStore;

        const {
            createInvoice,
            onChainAddress,
            payment_request,
            payment_request_amt,
            creatingInvoice,
            creatingInvoiceError,
            error_msg,
            watchedInvoicePaid,
            reset
        } = InvoicesStore;
        const { settings, loading, implementation } = SettingsStore;
        const { fiat } = settings;
        const address = onChainAddress;

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
                satAmount = value;
                break;
            case 'BTC':
                satAmount = Number(value) * satoshisPerBTC;
                break;
            case 'fiat':
                satAmount = Number(
                    (Number(value.replace(/,/g, '.')) / Number(rate)) *
                        Number(satoshisPerBTC)
                ).toFixed(0);
                break;
        }

        const lnurl: LNURLWithdrawParams | undefined =
            navigation.getParam('lnurlParams');

        const lightningButton = () => (
            <React.Fragment>
                <Text
                    style={{
                        color:
                            selectedIndex === 1
                                ? themeColor('text')
                                : themeColor('background'),
                        fontFamily: 'Lato-Regular'
                    }}
                >
                    {localeString('general.lightning')}
                </Text>
            </React.Fragment>
        );

        const onChainButton = () => (
            <React.Fragment>
                <Text
                    style={{
                        color:
                            selectedIndex === 0
                                ? themeColor('text')
                                : themeColor('background'),
                        fontFamily: 'Lato-Regular'
                    }}
                >
                    {localeString('general.onchain')}
                </Text>
            </React.Fragment>
        );

        const buttons = [
            { element: lightningButton },
            { element: onChainButton }
        ];

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => {
                    reset();
                    navigation.navigate('Wallet');
                }}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Receive.title'),
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

                {!watchedInvoicePaid && (
                    <ButtonGroup
                        onPress={this.updateIndex}
                        selectedIndex={selectedIndex}
                        buttons={buttons}
                        selectedButtonStyle={{
                            backgroundColor: themeColor('highlight'),
                            borderRadius: 12
                        }}
                        containerStyle={{
                            backgroundColor: themeColor('secondary'),
                            borderRadius: 12,
                            borderColor: themeColor('secondary')
                        }}
                        innerBorderStyle={{
                            color: themeColor('secondary')
                        }}
                    />
                )}

                <ScrollView style={styles.content}>
                    {watchedInvoicePaid ? (
                        <View
                            style={{
                                alignItems: 'center',
                                height: 400,
                                justifyContent: 'center'
                            }}
                        >
                            <Image
                                source={Success}
                                style={{ width: 290, height: 290 }}
                            />
                            <Text
                                style={{
                                    ...styles.text,
                                    fontSize: 20,
                                    top: -50,
                                    alignSelf: 'center'
                                }}
                            >
                                {`${localeString(
                                    'view.Receive.youReceived'
                                )} ${getAmount(payment_request_amt)}`}
                            </Text>
                        </View>
                    ) : (
                        selectedIndex === 0 && (
                            <View>
                                {!!payment_request && (
                                    <>
                                        <SuccessMessage
                                            message={localeString(
                                                'views.Receive.successCreate'
                                            )}
                                        />
                                        {!!lnurl && (
                                            <SuccessMessage
                                                message={
                                                    !!lnurl &&
                                                    ` ${localeString(
                                                        'views.Receive.andSentTo'
                                                    )} ${lnurl.domain}`
                                                }
                                            />
                                        )}
                                    </>
                                )}
                                {creatingInvoiceError && (
                                    <ErrorMessage
                                        message={localeString(
                                            'views.Receive.errorCreate'
                                        )}
                                    />
                                )}
                                {error_msg && (
                                    <Text
                                        style={{
                                            ...styles.text,
                                            top: 20,
                                            padding: 20
                                        }}
                                    >
                                        {error_msg}
                                    </Text>
                                )}
                                {creatingInvoice && <LoadingIndicator />}
                                {!!payment_request && (
                                    <CollapsedQR
                                        value={payment_request.toUpperCase()}
                                        copyText={localeString(
                                            'views.Receive.copyInvoice'
                                        )}
                                    />
                                )}
                                <Text
                                    style={{
                                        ...styles.secondaryText,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString('views.Receive.memo')}
                                </Text>
                                <TextInput
                                    placeholder={localeString(
                                        'views.Receive.memoPlaceholder'
                                    )}
                                    value={memo}
                                    onChangeText={(text: string) =>
                                        this.setState({ memo: text })
                                    }
                                />

                                <TouchableOpacity onPress={() => changeUnits()}>
                                    <Text
                                        style={{
                                            ...styles.secondaryText,
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {localeString('views.Receive.amount')}
                                        {lnurl &&
                                        lnurl.minWithdrawable !==
                                            lnurl.maxWithdrawable
                                            ? ` (${Math.ceil(
                                                  lnurl.minWithdrawable / 1000
                                              )}--${Math.floor(
                                                  lnurl.maxWithdrawable / 1000
                                              )})`
                                            : ''}
                                    </Text>
                                </TouchableOpacity>
                                <TextInput
                                    keyboardType="numeric"
                                    placeholder={'0'}
                                    value={value}
                                    onChangeText={(text: string) => {
                                        this.setState({ value: text });
                                    }}
                                    editable={
                                        lnurl &&
                                        lnurl.minWithdrawable ===
                                            lnurl.maxWithdrawable
                                            ? false
                                            : true
                                    }
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
                                    <Amount
                                        sats={satAmount}
                                        fixedUnits="sats"
                                        toggleable
                                    />
                                )}
                                {units !== 'BTC' && (
                                    <Amount
                                        sats={satAmount}
                                        fixedUnits="BTC"
                                        toggleable
                                    />
                                )}

                                {units === 'fiat' && (
                                    <TouchableOpacity
                                        onPress={() => changeUnits()}
                                    >
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

                                {implementation !== 'lndhub' && (
                                    <>
                                        <Text
                                            style={{
                                                ...styles.secondaryText,
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                paddingTop: 10
                                            }}
                                        >
                                            {localeString(
                                                'views.Receive.expiration'
                                            )}
                                        </Text>
                                        <TextInput
                                            keyboardType="numeric"
                                            placeholder={'3600 (one hour)'}
                                            value={expiry}
                                            onChangeText={(text: string) =>
                                                this.setState({ expiry: text })
                                            }
                                        />
                                    </>
                                )}

                                {implementation === 'lnd' && (
                                    <>
                                        <Text
                                            style={{
                                                ...styles.secondaryText,
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                top: 20
                                            }}
                                        >
                                            {localeString(
                                                'views.Receive.routeHints'
                                            )}
                                        </Text>
                                        <Switch
                                            value={routeHints}
                                            onValueChange={() =>
                                                this.setState({
                                                    routeHints: !routeHints
                                                })
                                            }
                                            trackColor={{
                                                false: '#767577',
                                                true: themeColor('highlight')
                                            }}
                                            style={{
                                                alignSelf: 'flex-end'
                                            }}
                                        />
                                    </>
                                )}

                                {RESTUtils.supportsAMP() && (
                                    <>
                                        <Text
                                            style={{
                                                ...styles.secondaryText,
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                top: 20
                                            }}
                                        >
                                            {localeString(
                                                'views.Receive.ampInvoice'
                                            )}
                                        </Text>
                                        <Switch
                                            value={ampInvoice}
                                            onValueChange={() =>
                                                this.setState({
                                                    ampInvoice: !ampInvoice
                                                })
                                            }
                                            trackColor={{
                                                false: '#767577',
                                                true: themeColor('highlight')
                                            }}
                                            style={{
                                                alignSelf: 'flex-end'
                                            }}
                                        />
                                    </>
                                )}

                                <View style={styles.button}>
                                    <Button
                                        title={
                                            localeString(
                                                'views.Receive.createInvoice'
                                            ) +
                                            (lnurl
                                                ? ` ${localeString(
                                                      'views.Receive.andSubmitTo'
                                                  )} ${lnurl.domain}`
                                                : '')
                                        }
                                        onPress={() =>
                                            createInvoice(
                                                memo,
                                                satAmount.toString() || '0',
                                                expiry,
                                                lnurl,
                                                ampInvoice,
                                                routeHints
                                            )
                                        }
                                    />
                                </View>
                            </View>
                        )
                    )}
                    {selectedIndex === 1 && (
                        <React.Fragment>
                            {!address && !loading && (
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString('views.Receive.noOnChain')}
                                </Text>
                            )}
                            {loading && <LoadingIndicator />}
                            {address && !loading && (
                                <CollapsedQR
                                    value={address}
                                    copyText={localeString(
                                        'views.Receive.copyAddress'
                                    )}
                                />
                            )}
                            {!(
                                (implementation === 'lndhub' && address) ||
                                loading
                            ) && (
                                <View style={styles.button}>
                                    <Button
                                        title={
                                            implementation === 'lndhub'
                                                ? localeString(
                                                      'views.Receive.getAddress'
                                                  )
                                                : localeString(
                                                      'views.Receive.getNewAddress'
                                                  )
                                        }
                                        onPress={() => this.getNewAddress()}
                                    />
                                </View>
                            )}
                        </React.Fragment>
                    )}
                </ScrollView>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    button: {
        paddingTop: 25,
        paddingBottom: 15
    },
    text: {
        fontFamily: 'Lato-Regular'
    },
    secondaryText: {
        fontFamily: 'Lato-Regular'
    }
});
