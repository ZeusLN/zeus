import * as React from 'react';
import {
    ActivityIndicator,
    Animated,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { LNURLWithdrawParams } from 'js-lnurl';
import { ButtonGroup, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Checkmark from '../images/SVG/Checkmark.svg';

import Button from './../components/Button';
import CollapsedQR from './../components/CollapsedQR';
import RESTUtils from './../utils/RESTUtils';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import InvoicesStore from './../stores/InvoicesStore';
import SettingsStore from './../stores/SettingsStore';
import UnitsStore, { satoshisPerBTC } from './../stores/UnitsStore';
import FiatStore from './../stores/FiatStore';

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
        value: '100',
        expiry: '3600',
        ampInvoice: false,
        routeHints: false
    };

    componentDidMount() {
        const { navigation } = this.props;
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
        const { units, changeUnits } = UnitsStore;
        const { fiatRates }: any = FiatStore;

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

        const rate =
            fiat && fiat !== 'Disabled' && fiatRates
                ? fiatRates[fiat]['15m']
                : 0;

        let satAmount: string | number;
        switch (units) {
            case 'sats':
                satAmount = value;
                break;
            case 'btc':
                satAmount = Number(value) * satoshisPerBTC;
                break;
            case 'fiat':
                satAmount = Number(
                    (Number(value) / Number(rate)) * Number(satoshisPerBTC)
                ).toFixed(0);
                break;
        }

        const lnurl: LNURLWithdrawParams | undefined =
            navigation.getParam('lnurlParams');

        const lightningButton = () => (
            <React.Fragment>
                <Text
                    style={{ color: selectedIndex === 1 ? 'white' : 'black' }}
                >
                    {localeString('general.lightning')}
                </Text>
            </React.Fragment>
        );

        const onChainButton = () => (
            <React.Fragment>
                <Text
                    style={{ color: selectedIndex === 0 ? 'white' : 'black' }}
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
                color="#fff"
                underlayColor="transparent"
            />
        );

        const fadeAnim = new Animated.Value(0);
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true
        }).start();

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
                        style: { color: '#fff' }
                    }}
                    backgroundColor="grey"
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
                            <Animated.View
                                style={{
                                    opacity: fadeAnim
                                }}
                            >
                                <Checkmark stroke={'green'} width={200} />
                                <Text
                                    style={{
                                        fontSize: 20,
                                        top: 15,
                                        color: themeColor('text'),
                                        alignSelf: 'center'
                                    }}
                                >
                                    {`${localeString(
                                        'view.Receive.youReceived'
                                    )} ${payment_request_amt} sats`}
                                </Text>
                            </Animated.View>
                        </View>
                    ) : (
                        selectedIndex === 0 && (
                            <View>
                                {!!payment_request && (
                                    <Text
                                        style={{ color: 'green', padding: 20 }}
                                    >
                                        {localeString(
                                            'views.Receive.successCreate'
                                        )}
                                        {!!lnurl &&
                                            ` ${localeString(
                                                'views.Receive.andSentTo'
                                            )} ${lnurl.domain}`}
                                    </Text>
                                )}
                                {creatingInvoiceError && (
                                    <Text style={{ color: 'red', padding: 20 }}>
                                        {localeString(
                                            'views.Receive.errorCreate'
                                        )}
                                    </Text>
                                )}
                                {error_msg && (
                                    <Text
                                        style={{
                                            ...styles.text,
                                            padding: 20
                                        }}
                                    >
                                        {error_msg}
                                    </Text>
                                )}
                                {creatingInvoice && (
                                    <ActivityIndicator
                                        size="large"
                                        color={themeColor('highlight')}
                                    />
                                )}
                                {!!payment_request && (
                                    <CollapsedQR
                                        value={payment_request.toUpperCase()}
                                        copyText={localeString(
                                            'views.Receive.copyInvoice'
                                        )}
                                    />
                                )}
                                <Text style={{ color: themeColor('text') }}>
                                    {localeString('views.Receive.memo')}:
                                </Text>
                                <TextInput
                                    placeholder={localeString(
                                        'views.Receive.memoPlaceholder'
                                    )}
                                    value={memo}
                                    onChangeText={(text: string) =>
                                        this.setState({ memo: text })
                                    }
                                    numberOfLines={1}
                                    editable={true}
                                    style={{
                                        ...styles.textInput,
                                        color: themeColor('text')
                                    }}
                                    placeholderTextColor="gray"
                                />

                                <TouchableOpacity onPress={() => changeUnits()}>
                                    <Text style={{ color: themeColor('text') }}>
                                        {localeString('views.Receive.amount')} (
                                        {units === 'fiat' ? fiat : units})
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
                                    placeholder={'100'}
                                    value={value}
                                    onChangeText={(text: string) => {
                                        this.setState({ value: text });
                                    }}
                                    numberOfLines={1}
                                    editable={
                                        lnurl &&
                                        lnurl.minWithdrawable ===
                                            lnurl.maxWithdrawable
                                            ? false
                                            : true
                                    }
                                    style={{
                                        ...styles.textInput,
                                        color: themeColor('text')
                                    }}
                                    placeholderTextColor="gray"
                                />
                                {units !== 'sats' && (
                                    <TouchableOpacity
                                        onPress={() => changeUnits()}
                                    >
                                        <Text
                                            style={{
                                                color: themeColor('text')
                                            }}
                                        >
                                            {UnitsStore.getAmount(
                                                satAmount,
                                                'sats'
                                            )}{' '}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                {units !== 'btc' && (
                                    <TouchableOpacity
                                        onPress={() => changeUnits()}
                                    >
                                        <Text
                                            style={{
                                                color: themeColor('text')
                                            }}
                                        >
                                            {UnitsStore.getAmount(
                                                satAmount,
                                                'btc'
                                            )}{' '}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {units === 'fiat' && (
                                    <TouchableOpacity
                                        onPress={() => changeUnits()}
                                    >
                                        <Text
                                            style={{
                                                color: themeColor('text')
                                            }}
                                        >
                                            {FiatStore.getRate()}{' '}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {implementation !== 'lndhub' && (
                                    <>
                                        <Text
                                            style={{
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Receive.expiration'
                                            )}
                                            :
                                        </Text>
                                        <TextInput
                                            keyboardType="numeric"
                                            placeholder={'3600 (one hour)'}
                                            value={expiry}
                                            onChangeText={(text: string) =>
                                                this.setState({ expiry: text })
                                            }
                                            numberOfLines={1}
                                            editable={true}
                                            style={{
                                                ...styles.textInput,
                                                color: themeColor('text')
                                            }}
                                            placeholderTextColor="gray"
                                        />
                                    </>
                                )}

                                {implementation === 'lnd' && (
                                    <>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Receive.routeHints'
                                            )}
                                            :
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
                                                ...styles.text,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Receive.ampInvoice'
                                            )}
                                            :
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
                                                satAmount.toString(),
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
                                <Text style={{ color: themeColor('text') }}>
                                    {localeString('views.Receive.noOnChain')}
                                </Text>
                            )}
                            {loading && (
                                <ActivityIndicator
                                    size="large"
                                    color={themeColor('highlight')}
                                />
                            )}
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
        top: 20
    },
    textInput: {
        fontSize: 20,
        paddingTop: 10,
        paddingBottom: 10
    }
});
