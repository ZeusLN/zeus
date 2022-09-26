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
import _map from 'lodash/map';

import Success from '../assets/images/GIF/Success.gif';

import { Amount } from './../components/Amount';
import Button from './../components/Button';
import CollapsedQR from './../components/CollapsedQR';
import LoadingIndicator from './../components/LoadingIndicator';
import ModalBox from './../components/ModalBox';
import {
    SuccessMessage,
    WarningMessage,
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
    addressType: string;
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
        addressType: '0',
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
        const amount: string = navigation.getParam('amount');

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

        if (amount) {
            this.setState({
                value: amount
            });
        }
    }

    getNewAddress = (params: any) => {
        const { InvoicesStore } = this.props;
        InvoicesStore.getNewAddress(params);
    };

    updateIndex = (selectedIndex: number) => {
        const { InvoicesStore } = this.props;

        this.setState({
            selectedIndex
        });

        // reset LN invoice values so old invoices don't linger
        InvoicesStore.clearUnified();
    };

    render() {
        const {
            InvoicesStore,
            SettingsStore,
            UnitsStore,
            FiatStore,
            navigation
        } = this.props;
        const {
            addressType,
            selectedIndex,
            memo,
            value,
            expiry,
            ampInvoice,
            routeHints
        } = this.state;
        const { units, changeUnits, getAmount } = UnitsStore;
        const { fiatRates, getSymbol }: any = FiatStore;

        const {
            createInvoice,
            createUnifiedInvoice,
            onChainAddress,
            payment_request,
            payment_request_amt,
            creatingInvoice,
            creatingInvoiceError,
            error_msg,
            watchedInvoicePaid,
            clearUnified,
            reset
        } = InvoicesStore;
        const { settings, implementation } = SettingsStore;
        const loading = SettingsStore.loading || InvoicesStore.loading;
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
                            selectedIndex === 0
                                ? themeColor('background')
                                : themeColor('text'),
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
                            selectedIndex === 1
                                ? themeColor('background')
                                : themeColor('text'),
                        fontFamily: 'Lato-Regular'
                    }}
                >
                    {localeString('general.onchain')}
                </Text>
            </React.Fragment>
        );

        const unifiedButton = () => (
            <React.Fragment>
                <Text
                    style={{
                        color:
                            selectedIndex === 2
                                ? themeColor('background')
                                : themeColor('text'),
                        fontFamily: 'Lato-Regular'
                    }}
                >
                    {localeString('general.unified')}
                </Text>
            </React.Fragment>
        );

        const buttons = [
            { element: lightningButton },
            { element: onChainButton },
            { element: unifiedButton }
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

        const SettingsButton = () => (
            <Icon
                name="settings"
                onPress={() => this.refs.modal.open()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        const ADDRESS_TYPES = RESTUtils.supportsTaproot()
            ? [
                  {
                      key: localeString('views.Receive.np2wkhKey'),
                      value: '1',
                      description: localeString(
                          'views.Receive.np2wkhDescription'
                      )
                  },
                  {
                      key: localeString('views.Receive.p2wkhKey'),
                      value: '0',
                      description: localeString(
                          'views.Receive.p2wkhDescription'
                      )
                  },
                  {
                      key: localeString('views.Receive.p2trKey'),
                      value: '4',
                      description: localeString('views.Receive.p2trDescription')
                  }
              ]
            : [
                  {
                      key: localeString('views.Receive.np2wkhKey'),
                      value: '1',
                      description: localeString(
                          'views.Receive.np2wkhDescriptionAlt'
                      )
                  },
                  {
                      key: localeString('views.Receive.p2wkhKey'),
                      value: '0',
                      description: localeString(
                          'views.Receive.p2wkhDescription'
                      )
                  }
              ];

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
                    rightComponent={
                        RESTUtils.supportsAddressTypeSelection() &&
                        selectedIndex === 1 ? (
                            <SettingsButton />
                        ) : null
                    }
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
                    {error_msg && <ErrorMessage message={error_msg} />}

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
                                    'views.Receive.youReceived'
                                )} ${getAmount(payment_request_amt)}`}
                            </Text>
                        </View>
                    ) : (
                        (selectedIndex === 0 || selectedIndex === 2) && (
                            <View>
                                {!!payment_request && (
                                    <>
                                        <SuccessMessage
                                            message={localeString(
                                                'views.Receive.successCreate'
                                            )}
                                        />
                                        {implementation === 'lndhub' && (
                                            <WarningMessage
                                                message={localeString(
                                                    'views.Receive.warningLndHub'
                                                )}
                                            />
                                        )}
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
                                {creatingInvoice && <LoadingIndicator />}
                                {selectedIndex === 0 && !!payment_request && (
                                    <CollapsedQR
                                        value={payment_request.toUpperCase()}
                                        copyText={localeString(
                                            'views.Receive.copyInvoice'
                                        )}
                                    />
                                )}
                                {selectedIndex === 2 &&
                                    !!payment_request &&
                                    !!address && (
                                        <CollapsedQR
                                            value={`bitcoin:${address.toUpperCase()}?${
                                                value
                                                    ? `amount=${
                                                          Number(satAmount) /
                                                          satoshisPerBTC
                                                      }&`
                                                    : ''
                                            }${
                                                memo
                                                    ? `message=${memo.replace(
                                                          / /g,
                                                          '%20'
                                                      )}&`
                                                    : ''
                                            }lightning=${payment_request.toUpperCase()}`}
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
                                    onChangeText={(text: string) => {
                                        this.setState({ memo: text });
                                        clearUnified();
                                    }}
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
                                                selectedIndex === 0
                                                    ? 'views.Receive.createInvoice'
                                                    : 'views.Receive.createUnifiedInvoice'
                                            ) +
                                            (lnurl
                                                ? ` ${localeString(
                                                      'views.Receive.andSubmitTo'
                                                  )} ${lnurl.domain}`
                                                : '')
                                        }
                                        onPress={() =>
                                            selectedIndex === 0
                                                ? createInvoice(
                                                      memo,
                                                      satAmount.toString() ||
                                                          '0',
                                                      expiry,
                                                      lnurl,
                                                      ampInvoice,
                                                      routeHints
                                                  )
                                                : createUnifiedInvoice(
                                                      memo,
                                                      satAmount.toString() ||
                                                          '0',
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
                                <View style={{ marginTop: 10 }}>
                                    <CollapsedQR
                                        value={address}
                                        copyText={localeString(
                                            'views.Receive.copyAddress'
                                        )}
                                    />
                                </View>
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
                                        onPress={() =>
                                            this.getNewAddress(
                                                RESTUtils.supportsAddressTypeSelection()
                                                    ? {
                                                          type: addressType
                                                      }
                                                    : null
                                            )
                                        }
                                    />
                                </View>
                            )}
                        </React.Fragment>
                    )}
                </ScrollView>
                <ModalBox
                    style={{
                        backgroundColor: themeColor('background'),
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        height: RESTUtils.supportsTaproot() ? 450 : 350,
                        paddingLeft: 24,
                        paddingRight: 24
                    }}
                    swipeToClose={true}
                    backButtonClose={true}
                    position="bottom"
                    ref="modal"
                >
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontSize: 24,
                            fontWeight: 'bold',
                            paddingTop: 24,
                            paddingBottom: 24
                        }}
                    >
                        {localeString('views.Receive.addressType')}
                    </Text>
                    {_map(ADDRESS_TYPES, (d) => (
                        <TouchableOpacity
                            onPress={() => {
                                InvoicesStore.clearAddress();
                                this.setState({ addressType: d.value });
                                this.refs.modal.close();
                            }}
                            style={{
                                backgroundColor: themeColor('secondary'),
                                borderColor:
                                    d.value === addressType
                                        ? themeColor('highlight')
                                        : themeColor('secondaryText'),
                                borderRadius: 4,
                                borderWidth: d.value === addressType ? 2 : 1,
                                padding: 16,
                                marginBottom: 24
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontSize: 16,
                                    fontWeight: 'bold',
                                    marginBottom: 4
                                }}
                            >
                                {d.key}
                            </Text>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontSize: 16,
                                    fontWeight: 'regular'
                                }}
                            >
                                {d.description}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ModalBox>
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
