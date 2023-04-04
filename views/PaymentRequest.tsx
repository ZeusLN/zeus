import * as React from 'react';
import {
    NativeModules,
    NativeEventEmitter,
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Icon } from 'react-native-elements';

import Amount from '../components/Amount';
import Header from '../components/Header';
import Button from '../components/Button';
import HopPicker from '../components/HopPicker';
import KeyValue from '../components/KeyValue';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import Switch from '../components/Switch';
import TextInput from '../components/TextInput';

import ChannelsStore from '../stores/ChannelsStore';
import FiatStore from '../stores/FiatStore';
import InvoicesStore from '../stores/InvoicesStore';
import TransactionsStore, { SendPaymentReq } from '../stores/TransactionsStore';
import UnitsStore, { SATS_PER_BTC } from '../stores/UnitsStore';
import SettingsStore from '../stores/SettingsStore';

import FeeUtils from '../utils/FeeUtils';
import { localeString } from '../utils/LocaleUtils';
import BackendUtils from '../utils/BackendUtils';
import { themeColor } from '../utils/ThemeUtils';

import { Row } from '../components/layout/Row';

import CaretDown from '../assets/images/SVG/Caret Down.svg';
import CaretRight from '../assets/images/SVG/Caret Right.svg';
import { FeeMethod, Implementation, Units } from '../enums';

interface InvoiceProps {
    exitSetup: any;
    navigation: any;
    InvoicesStore: InvoicesStore;
    TransactionsStore: TransactionsStore;
    UnitsStore: UnitsStore;
    ChannelsStore: ChannelsStore;
    SettingsStore: SettingsStore;
    FiatStore: FiatStore;
}

interface InvoiceState {
    customAmount: string;
    enableMultiPathPayment: boolean;
    enableAtomicMultiPathPayment: boolean;
    maxParts: string;
    maxShardAmt: string;
    feeLimitSat: string;
    feeOption: string;
    maxFeePercent: string;
    outgoingChanId: string | null;
    lastHopPubkey: string | null;
    settingsToggle: boolean;
}

@inject(
    'FiatStore',
    'InvoicesStore',
    'TransactionsStore',
    'UnitsStore',
    'ChannelsStore',
    'SettingsStore'
)
@observer
export default class PaymentRequest extends React.Component<
    InvoiceProps,
    InvoiceState
> {
    listener: any;
    state = {
        customAmount: '',
        enableMultiPathPayment: true,
        enableAtomicMultiPathPayment: false,
        maxParts: '16',
        maxShardAmt: '',
        feeLimitSat: '100',
        feeOption: FeeMethod.fixed,
        maxFeePercent: '0.5',
        outgoingChanId: null,
        lastHopPubkey: null,
        settingsToggle: false
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            feeOption: settings.payments.defaultFeeMethod || FeeMethod.fixed,
            feeLimitSat: settings.payments.defaultFeeFixed || '100',
            maxFeePercent: settings.payments.defaultFeePercentage || '0.5'
        });
    }

    subscribePayment = (streamingCall: string) => {
        const { handlePayment, handlePaymentError } =
            this.props.TransactionsStore;
        const { LncModule } = NativeModules;
        const eventEmitter = new NativeEventEmitter(LncModule);
        this.listener = eventEmitter.addListener(
            streamingCall,
            (event: any) => {
                if (event.result && event.result !== 'EOF') {
                    try {
                        const result = JSON.parse(event.result);
                        if (result && result.status !== 'IN_FLIGHT') {
                            handlePayment(result);
                            this.listener = null;
                        }
                    } catch (error: any) {
                        handlePaymentError(event.result);
                        this.listener = null;
                    }
                }
            }
        );
    };

    displayFeeRecommendation = () => {
        const { feeLimitSat } = this.state;
        const { InvoicesStore } = this.props;
        const { feeEstimate } = InvoicesStore;

        if (
            feeEstimate &&
            feeLimitSat &&
            Number(feeEstimate) > Number(feeLimitSat)
        ) {
            return (
                <Text
                    style={{
                        color: themeColor('error')
                    }}
                >
                    {localeString(
                        'views.PaymentRequest.feeEstimateExceedsLimit'
                    )}
                </Text>
            );
        }
        return null;
    };

    sendPayment = (
        feeOption: string,
        percentAmount: string,
        {
            payment_request,
            amount, // used only for no-amount invoices
            max_parts,
            max_shard_amt,
            fee_limit_sat,
            max_fee_percent,
            outgoing_chan_id,
            last_hop_pubkey,
            amp
        }: SendPaymentReq
    ) => {
        const { InvoicesStore, TransactionsStore, SettingsStore, navigation } =
            this.props;
        let feeLimitSat = fee_limit_sat;

        if (feeOption == FeeMethod.fixed) {
            // If the fee limit is not set, use a default routing fee calculation
            if (!fee_limit_sat) {
                const { pay_req } = InvoicesStore;
                const requestAmount = pay_req && pay_req.getRequestAmount;
                const invoiceAmount = amount || requestAmount;
                feeLimitSat = FeeUtils.calculateDefaultRoutingFee(
                    Number(invoiceAmount)
                );
            }
        } else if (feeOption == FeeMethod.percent) {
            feeLimitSat = percentAmount;
        }

        const streamingCall = TransactionsStore.sendPayment({
            payment_request,
            amount,
            max_parts,
            max_shard_amt,
            fee_limit_sat: feeLimitSat,
            max_fee_percent,
            outgoing_chan_id,
            last_hop_pubkey,
            amp
        });

        if (SettingsStore.implementation === 'lightning-node-connect') {
            this.subscribePayment(streamingCall);
        }

        navigation.navigate('SendingLightning');
    };

    render() {
        const {
            InvoicesStore,
            FiatStore,
            UnitsStore,
            ChannelsStore,
            SettingsStore,
            navigation
        } = this.props;
        const {
            enableMultiPathPayment,
            enableAtomicMultiPathPayment,
            maxParts,
            maxShardAmt,
            feeLimitSat,
            feeOption,
            maxFeePercent,
            outgoingChanId,
            lastHopPubkey,
            customAmount,
            settingsToggle
        } = this.state;
        const {
            pay_req,
            paymentRequest,
            getPayReqError,
            loading,
            loadingFeeEstimate,
            successProbability,
            feeEstimate,
            clearPayReq
        } = InvoicesStore;
        const { units, changeUnits } = UnitsStore;
        const { fiatRates, getSymbol } = FiatStore;
        const { settings } = SettingsStore;
        const { fiat } = settings;

        const requestAmount = pay_req && pay_req.getRequestAmount;
        const expiry = pay_req && pay_req.expiry;
        const cltv_expiry = pay_req && pay_req.cltv_expiry;
        const destination = pay_req && pay_req.destination;
        const description = pay_req && pay_req.description;
        const payment_hash = pay_req && pay_req.payment_hash;
        const timestamp = pay_req && pay_req.timestamp;

        const fiatEntry =
            fiat && fiatRates && fiatRates.filter
                ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
                : null;

        const rate =
            fiat && fiat !== 'Disabled' && fiatRates && fiatEntry
                ? fiatEntry.rate
                : 0;

        // conversion
        let satAmount: string | number;
        switch (units) {
            case Units.sats:
                satAmount = customAmount;
                break;
            case Units.BTC:
                satAmount = Number(customAmount) * SATS_PER_BTC;
                break;
            case Units.fiat:
                satAmount = Number(
                    (Number(customAmount.replace(/,/g, '.')) / Number(rate)) *
                        Number(SATS_PER_BTC)
                ).toFixed(0);
                break;
        }

        // handle fee percents that use commas
        const maxFeePercentFormatted = maxFeePercent.replace(/,/g, '.');

        const percentAmount = customAmount
            ? (
                  Number(customAmount) *
                  (Number(maxFeePercentFormatted) / 100)
              ).toFixed()
            : requestAmount
            ? (requestAmount * (Number(maxFeePercentFormatted) / 100)).toFixed()
            : 0;

        let lockAtomicMultiPathPayment = false;
        if (
            pay_req &&
            pay_req.features &&
            pay_req.features['30'] &&
            pay_req.features['30'].is_required
        ) {
            lockAtomicMultiPathPayment = true;
        }

        const enableAmp: boolean =
            enableAtomicMultiPathPayment || lockAtomicMultiPathPayment;
        const ampOrMppEnabled: boolean =
            (BackendUtils.supportsMPP() || BackendUtils.supportsAMP()) &&
            (enableMultiPathPayment || enableAmp);

        const date = new Date(Number(timestamp) * 1000).toString();

        const { enableTor, implementation } = SettingsStore;

        const isLnd: boolean = BackendUtils.isLNDBased();
        const isCLightning: boolean =
            implementation === Implementation.clightningREST;

        const isNoAmountInvoice: boolean =
            !requestAmount || requestAmount === 0;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => {
                    clearPayReq();
                    navigation.goBack();
                }}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <Screen>
                <Header
                    leftComponent={BackButton}
                    centerComponent={{
                        text: localeString('views.PaymentRequest.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                />

                {(loading || loadingFeeEstimate) && (
                    <View style={{ marginTop: 40 }}>
                        <LoadingIndicator />
                    </View>
                )}

                <ScrollView>
                    {!!getPayReqError && (
                        <View style={styles.content}>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.PaymentRequest.error')}:{' '}
                                {getPayReqError}
                            </Text>
                        </View>
                    )}

                    {!loading && !loadingFeeEstimate && !!pay_req && (
                        <View style={styles.content}>
                            <>
                                {isNoAmountInvoice ? (
                                    <>
                                        <Text
                                            style={{
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.PaymentRequest.customAmt'
                                            )}
                                        </Text>
                                        <TextInput
                                            keyboardType="numeric"
                                            placeholder={
                                                requestAmount
                                                    ? requestAmount.toString()
                                                    : '0'
                                            }
                                            value={customAmount}
                                            onChangeText={(text: string) =>
                                                this.setState({
                                                    customAmount: text
                                                })
                                            }
                                            numberOfLines={1}
                                            style={{
                                                ...styles.textInput,
                                                color: themeColor('text')
                                            }}
                                            placeholderTextColor="gray"
                                            prefix={
                                                units !== Units.sats &&
                                                (units === Units.BTC
                                                    ? '₿'
                                                    : !getSymbol().rtl
                                                    ? getSymbol().symbol
                                                    : null)
                                            }
                                            suffix={
                                                units === Units.sats
                                                    ? units
                                                    : getSymbol().rtl &&
                                                      units === Units.fiat &&
                                                      getSymbol().symbol
                                            }
                                            toggleUnits={changeUnits}
                                        />
                                        {fiat !== 'Disabled' &&
                                            units !== Units.fiat && (
                                                <Amount
                                                    sats={satAmount}
                                                    fixedUnits={Units.fiat}
                                                    toggleable
                                                />
                                            )}
                                        {fiat !== 'Disabled' && (
                                            <TouchableOpacity
                                                onPress={() => changeUnits()}
                                            >
                                                <Text
                                                    style={{
                                                        color: themeColor(
                                                            'text'
                                                        )
                                                    }}
                                                >
                                                    {FiatStore.getRate(
                                                        units === Units.sats
                                                    )}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                        {units !== Units.sats && (
                                            <Amount
                                                sats={satAmount}
                                                fixedUnits={Units.sats}
                                                toggleable
                                            />
                                        )}
                                        {units !== Units.BTC && (
                                            <Amount
                                                sats={satAmount}
                                                fixedUnits={Units.BTC}
                                                toggleable
                                            />
                                        )}
                                    </>
                                ) : (
                                    <View style={styles.center}>
                                        <Amount
                                            sats={requestAmount}
                                            jumboText
                                            toggleable
                                        />
                                    </View>
                                )}
                            </>

                            {!!description && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.description'
                                    )}
                                    value={description}
                                />
                            )}

                            {!!timestamp && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.timestamp'
                                    )}
                                    value={date}
                                />
                            )}

                            {!!expiry && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.expiry'
                                    )}
                                    value={expiry}
                                />
                            )}

                            {!!cltv_expiry && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.cltvExpiry'
                                    )}
                                    value={cltv_expiry}
                                />
                            )}

                            {!!destination && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.destination'
                                    )}
                                    value={destination}
                                />
                            )}

                            {!!payment_hash && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.paymentHash'
                                    )}
                                    value={payment_hash}
                                />
                            )}

                            {!!successProbability && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.successProbability'
                                    )}
                                    value={`${successProbability}%`}
                                />
                            )}

                            {(!!feeEstimate || feeEstimate === 0) && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.feeEstimate'
                                    )}
                                    value={
                                        <Amount
                                            sats={feeEstimate || 0}
                                            toggleable
                                        />
                                    }
                                />
                            )}

                            {(isLnd || isCLightning) && (
                                <TouchableOpacity
                                    onPress={() => {
                                        this.setState({
                                            settingsToggle: !settingsToggle
                                        });
                                    }}
                                >
                                    <View
                                        style={{
                                            marginTop: 10,
                                            marginBottom: 10
                                        }}
                                    >
                                        <Row justify="space-between">
                                            <View style={{ width: '95%' }}>
                                                <KeyValue
                                                    keyValue={localeString(
                                                        'views.Settings.title'
                                                    )}
                                                />
                                            </View>
                                            {settingsToggle ? (
                                                <CaretDown
                                                    fill={themeColor('text')}
                                                    width="20"
                                                    height="20"
                                                />
                                            ) : (
                                                <CaretRight
                                                    fill={themeColor('text')}
                                                    width="20"
                                                    height="20"
                                                />
                                            )}
                                        </Row>
                                    </View>
                                </TouchableOpacity>
                            )}

                            {settingsToggle && (
                                <>
                                    {isLnd && (
                                        <>
                                            <Text
                                                style={{
                                                    ...styles.label,
                                                    color: themeColor('text')
                                                }}
                                            >
                                                {`${localeString(
                                                    'views.PaymentRequest.feeLimit'
                                                )} (${localeString(
                                                    'general.optional'
                                                )})`}
                                            </Text>
                                            {this.displayFeeRecommendation()}
                                            <View
                                                style={{
                                                    flex: 1,
                                                    flexWrap: 'wrap',
                                                    flexDirection: 'row',
                                                    justifyContent: 'flex-end',
                                                    opacity:
                                                        feeOption ==
                                                        FeeMethod.percent
                                                            ? 1
                                                            : 0.25
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        ...styles.label,
                                                        color: themeColor(
                                                            'text'
                                                        )
                                                    }}
                                                >
                                                    <Amount
                                                        sats={percentAmount}
                                                    />
                                                </Text>
                                            </View>
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    width: '95%'
                                                }}
                                            >
                                                <TextInput
                                                    style={{
                                                        width: '50%',
                                                        opacity:
                                                            feeOption ==
                                                            FeeMethod.fixed
                                                                ? 1
                                                                : 0.25
                                                    }}
                                                    keyboardType="numeric"
                                                    value={feeLimitSat}
                                                    onChangeText={(
                                                        text: string
                                                    ) =>
                                                        this.setState({
                                                            feeLimitSat: text
                                                        })
                                                    }
                                                    onPressIn={() =>
                                                        this.setState({
                                                            feeOption:
                                                                FeeMethod.fixed
                                                        })
                                                    }
                                                />
                                                <Text
                                                    style={{
                                                        ...styles.label,
                                                        color: themeColor(
                                                            'text'
                                                        ),
                                                        top: 28,
                                                        right: 30,
                                                        opacity:
                                                            feeOption ==
                                                            FeeMethod.fixed
                                                                ? 1
                                                                : 0.25
                                                    }}
                                                >
                                                    {`${localeString(
                                                        'general.sats'
                                                    )}`}
                                                </Text>
                                                <TextInput
                                                    style={{
                                                        width: '50%',
                                                        opacity:
                                                            feeOption ==
                                                            FeeMethod.percent
                                                                ? 1
                                                                : 0.25
                                                    }}
                                                    keyboardType="numeric"
                                                    value={maxFeePercent}
                                                    onChangeText={(
                                                        text: string
                                                    ) =>
                                                        this.setState({
                                                            maxFeePercent: text
                                                        })
                                                    }
                                                    onPressIn={() =>
                                                        this.setState({
                                                            feeOption:
                                                                FeeMethod.percent
                                                        })
                                                    }
                                                />
                                                <Text
                                                    style={{
                                                        ...styles.label,
                                                        color: themeColor(
                                                            'text'
                                                        ),
                                                        top: 28,
                                                        right: 18,
                                                        opacity:
                                                            feeOption ==
                                                            FeeMethod.percent
                                                                ? 1
                                                                : 0.25
                                                    }}
                                                >
                                                    {'%'}
                                                </Text>
                                            </View>
                                        </>
                                    )}

                                    {isCLightning && (
                                        <>
                                            <Text
                                                style={{
                                                    ...styles.label,
                                                    color: themeColor('text')
                                                }}
                                            >
                                                {`${localeString(
                                                    'views.PaymentRequest.feeLimit'
                                                )} (${localeString(
                                                    'general.percentage'
                                                )})`}
                                            </Text>
                                            <TextInput
                                                keyboardType="numeric"
                                                placeholder={'0.5'}
                                                value={maxFeePercent}
                                                onChangeText={(text: string) =>
                                                    this.setState({
                                                        maxFeePercent: text
                                                    })
                                                }
                                            />
                                        </>
                                    )}

                                    {!!pay_req &&
                                        BackendUtils.supportsHopPicking() && (
                                            <>
                                                {
                                                    <HopPicker
                                                        onValueChange={(
                                                            item: any
                                                        ) =>
                                                            this.setState({
                                                                outgoingChanId:
                                                                    item
                                                                        ? item.channelId
                                                                        : null
                                                            })
                                                        }
                                                        title={localeString(
                                                            'views.PaymentRequest.firstHop'
                                                        )}
                                                        ChannelsStore={
                                                            ChannelsStore
                                                        }
                                                        UnitsStore={UnitsStore}
                                                    />
                                                }
                                                {
                                                    <HopPicker
                                                        onValueChange={(
                                                            item: any
                                                        ) =>
                                                            this.setState({
                                                                lastHopPubkey:
                                                                    item
                                                                        ? item.remote_pubkey
                                                                        : null
                                                            })
                                                        }
                                                        title={localeString(
                                                            'views.PaymentRequest.lastHop'
                                                        )}
                                                        ChannelsStore={
                                                            ChannelsStore
                                                        }
                                                        UnitsStore={UnitsStore}
                                                    />
                                                }
                                            </>
                                        )}

                                    {!!pay_req &&
                                        BackendUtils.supportsMPP() &&
                                        !enableTor && (
                                            <React.Fragment>
                                                <Text
                                                    style={{
                                                        ...styles.label,
                                                        color: themeColor(
                                                            'text'
                                                        ),
                                                        top: 25
                                                    }}
                                                >
                                                    {localeString(
                                                        'views.PaymentRequest.mpp'
                                                    )}
                                                </Text>
                                                <View
                                                    style={{
                                                        flex: 1,
                                                        flexDirection: 'row',
                                                        justifyContent:
                                                            'flex-end'
                                                    }}
                                                >
                                                    <Switch
                                                        value={
                                                            enableMultiPathPayment
                                                        }
                                                        onValueChange={() => {
                                                            const enable =
                                                                !enableMultiPathPayment;
                                                            this.setState({
                                                                enableMultiPathPayment:
                                                                    enable,
                                                                enableAtomicMultiPathPayment:
                                                                    enableMultiPathPayment
                                                                        ? false
                                                                        : true
                                                            });
                                                        }}
                                                    />
                                                </View>
                                            </React.Fragment>
                                        )}

                                    {!!pay_req && BackendUtils.supportsAMP() && (
                                        <React.Fragment>
                                            <Text
                                                style={{
                                                    ...styles.label,
                                                    color: themeColor('text'),
                                                    top: 25
                                                }}
                                            >
                                                {localeString(
                                                    'views.PaymentRequest.amp'
                                                )}
                                            </Text>
                                            <View
                                                style={{
                                                    flex: 1,
                                                    flexDirection: 'row',
                                                    justifyContent: 'flex-end'
                                                }}
                                            >
                                                <Switch
                                                    value={enableAmp}
                                                    onValueChange={() => {
                                                        const enable =
                                                            !enableAtomicMultiPathPayment;
                                                        this.setState({
                                                            enableAtomicMultiPathPayment:
                                                                enable,
                                                            enableMultiPathPayment:
                                                                enable ||
                                                                enableMultiPathPayment
                                                        });
                                                    }}
                                                    disabled={
                                                        lockAtomicMultiPathPayment
                                                    }
                                                />
                                            </View>
                                        </React.Fragment>
                                    )}

                                    {ampOrMppEnabled && (
                                        <React.Fragment>
                                            <Text
                                                style={{
                                                    ...styles.label,
                                                    color: themeColor('text')
                                                }}
                                            >
                                                {localeString(
                                                    'views.PaymentRequest.maxParts'
                                                )}
                                            </Text>
                                            <TextInput
                                                keyboardType="numeric"
                                                value={maxParts}
                                                onChangeText={(text: string) =>
                                                    this.setState({
                                                        maxParts: text
                                                    })
                                                }
                                            />
                                            <Text
                                                style={{
                                                    ...styles.labelSecondary,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {localeString(
                                                    'views.PaymentRequest.maxPartsDescription'
                                                )}
                                            </Text>
                                        </React.Fragment>
                                    )}

                                    {ampOrMppEnabled && (
                                        <React.Fragment>
                                            <Text
                                                style={{
                                                    ...styles.label,
                                                    color: themeColor('text')
                                                }}
                                            >
                                                {`${localeString(
                                                    'views.PaymentRequest.maxShardAmt'
                                                )} (${localeString(
                                                    'general.sats'
                                                )}) (${localeString(
                                                    'general.optional'
                                                )})`}
                                            </Text>
                                            <TextInput
                                                keyboardType="numeric"
                                                value={maxShardAmt}
                                                onChangeText={(text: string) =>
                                                    this.setState({
                                                        maxShardAmt: text
                                                    })
                                                }
                                            />
                                        </React.Fragment>
                                    )}
                                </>
                            )}

                            {!!pay_req && (
                                <View style={styles.button}>
                                    <Button
                                        title={localeString(
                                            'views.PaymentRequest.payInvoice'
                                        )}
                                        icon={{
                                            name: 'send',
                                            size: 25
                                        }}
                                        onPress={() => {
                                            this.sendPayment(
                                                feeOption,
                                                String(percentAmount),
                                                {
                                                    payment_request:
                                                        paymentRequest,
                                                    amount: satAmount
                                                        ? satAmount.toString()
                                                        : undefined,
                                                    max_parts:
                                                        enableMultiPathPayment
                                                            ? maxParts
                                                            : null,
                                                    max_shard_amt:
                                                        enableMultiPathPayment
                                                            ? maxShardAmt
                                                            : null,
                                                    fee_limit_sat: isLnd
                                                        ? feeLimitSat
                                                        : null,
                                                    max_fee_percent:
                                                        isCLightning
                                                            ? maxFeePercentFormatted
                                                            : null,
                                                    outgoing_chan_id:
                                                        outgoingChanId,
                                                    last_hop_pubkey:
                                                        lastHopPubkey,
                                                    amp: enableAmp
                                                }
                                            );
                                        }}
                                    />
                                </View>
                            )}
                        </View>
                    )}
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
    label: {
        fontFamily: 'Lato-Regular',
        paddingTop: 5
    },
    labelSecondary: {
        fontFamily: 'Lato-Regular',
        paddingTop: 5
    },
    button: {
        paddingTop: 30,
        paddingBottom: 15,
        paddingLeft: 10,
        paddingRight: 10
    },
    center: {
        alignItems: 'center',
        marginTop: 25,
        marginBottom: 25
    }
});
