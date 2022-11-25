import * as React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Header, Icon } from 'react-native-elements';

import { Amount } from './../components/Amount';
import Button from './../components/Button';
import HopPicker from './../components/HopPicker';
import KeyValue from './../components/KeyValue';
import LoadingIndicator from './../components/LoadingIndicator';
import TextInput from './../components/TextInput';

import InvoicesStore from './../stores/InvoicesStore';
import TransactionsStore, {
    SendPaymentReq
} from './../stores/TransactionsStore';
import UnitsStore from './../stores/UnitsStore';
import ChannelsStore from './../stores/ChannelsStore';
import SettingsStore from './../stores/SettingsStore';

import FeeUtils from './../utils/FeeUtils';
import { localeString } from './../utils/LocaleUtils';
import RESTUtils from './../utils/RESTUtils';
import { themeColor } from './../utils/ThemeUtils';

interface InvoiceProps {
    exitSetup: any;
    navigation: any;
    InvoicesStore: InvoicesStore;
    TransactionsStore: TransactionsStore;
    UnitsStore: UnitsStore;
    ChannelsStore: ChannelsStore;
    SettingsStore: SettingsStore;
}

interface InvoiceState {
    customAmount: string;
    enableMultiPathPayment: boolean;
    enableAtomicMultiPathPayment: boolean;
    maxParts: string;
    maxShardAmt: string;
    feeLimitSat: string;
    maxFeePercent: string;
    outgoingChanId: string | null;
    lastHopPubkey: string | null;
}

@inject(
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
    state = {
        customAmount: '',
        enableMultiPathPayment: true,
        enableAtomicMultiPathPayment: false,
        maxParts: '16',
        maxShardAmt: '',
        feeLimitSat: '100',
        maxFeePercent: '0.5',
        outgoingChanId: null,
        lastHopPubkey: null
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

    sendPayment = ({
        payment_request,
        amount, // used only for no-amount invoices
        max_parts,
        max_shard_amt,
        fee_limit_sat,
        max_fee_percent,
        outgoing_chan_id,
        last_hop_pubkey,
        amp
    }: SendPaymentReq) => {
        const { InvoicesStore, TransactionsStore, navigation } = this.props;
        let feeLimitSat = fee_limit_sat;

        // If the fee limit is not set, use a default routing fee calculation
        if (!fee_limit_sat) {
            const { pay_req } = InvoicesStore;
            const requestAmount = pay_req && pay_req.getRequestAmount;
            const invoiceAmount = amount || requestAmount;

            feeLimitSat = FeeUtils.calculateDefaultRoutingFee(
                Number(invoiceAmount)
            );
        }

        TransactionsStore.sendPayment({
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

        navigation.navigate('SendingLightning');
    };

    render() {
        const {
            InvoicesStore,
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
            maxFeePercent,
            outgoingChanId,
            lastHopPubkey,
            customAmount
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

        const requestAmount = pay_req && pay_req.getRequestAmount;
        const expiry = pay_req && pay_req.expiry;
        const cltv_expiry = pay_req && pay_req.cltv_expiry;
        const destination = pay_req && pay_req.destination;
        const description = pay_req && pay_req.description;
        const payment_hash = pay_req && pay_req.payment_hash;
        const timestamp = pay_req && pay_req.timestamp;

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
            (RESTUtils.supportsMPP() || RESTUtils.supportsAMP()) &&
            (enableMultiPathPayment || enableAmp);

        const date = new Date(Number(timestamp) * 1000).toString();

        const { enableTor, implementation } = SettingsStore;

        const isLnd: boolean = implementation === 'lnd';
        const isCLightning: boolean = implementation === 'c-lightning-REST';

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
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.PaymentRequest.title'),
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

                {(loading || loadingFeeEstimate) && <LoadingIndicator />}

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

                    {!loading && !!pay_req && (
                        <View style={styles.content}>
                            <View style={styles.center}>
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
                                        />
                                    </>
                                ) : (
                                    <Amount
                                        sats={requestAmount}
                                        jumboText
                                        toggleable
                                    />
                                )}
                            </View>

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
                                            'general.sats'
                                        )}) (${localeString(
                                            'general.optional'
                                        )})`}
                                    </Text>
                                    {this.displayFeeRecommendation()}
                                    <TextInput
                                        keyboardType="numeric"
                                        value={feeLimitSat}
                                        onChangeText={(text: string) =>
                                            this.setState({
                                                feeLimitSat: text
                                            })
                                        }
                                    />
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

                            {!!pay_req && RESTUtils.supportsHopPicking() && (
                                <>
                                    {
                                        <HopPicker
                                            onValueChange={(item: any) =>
                                                this.setState({
                                                    outgoingChanId: item
                                                        ? item.channelId
                                                        : null
                                                })
                                            }
                                            title={localeString(
                                                'views.PaymentRequest.firstHop'
                                            )}
                                            ChannelsStore={ChannelsStore}
                                            UnitsStore={UnitsStore}
                                        />
                                    }
                                    {
                                        <HopPicker
                                            onValueChange={(item: any) =>
                                                this.setState({
                                                    lastHopPubkey: item
                                                        ? item.remote_pubkey
                                                        : null
                                                })
                                            }
                                            title={localeString(
                                                'views.PaymentRequest.lastHop'
                                            )}
                                            ChannelsStore={ChannelsStore}
                                            UnitsStore={UnitsStore}
                                        />
                                    }
                                </>
                            )}

                            {!!pay_req &&
                                RESTUtils.supportsMPP() &&
                                !enableTor && (
                                    <React.Fragment>
                                        <Text
                                            style={{
                                                ...styles.label,
                                                color: themeColor('text'),
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
                                                justifyContent: 'flex-end'
                                            }}
                                        >
                                            <Switch
                                                value={enableMultiPathPayment}
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
                                                trackColor={{
                                                    false: '#767577',
                                                    true: themeColor(
                                                        'highlight'
                                                    )
                                                }}
                                            />
                                        </View>
                                    </React.Fragment>
                                )}

                            {!!pay_req && RESTUtils.supportsAMP() && (
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
                                            trackColor={{
                                                false: '#767577',
                                                true: themeColor('highlight')
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
                                            color: themeColor('secondaryText')
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

                            {!!pay_req && (
                                <View style={styles.button}>
                                    <Button
                                        title="Pay this invoice"
                                        icon={{
                                            name: 'send',
                                            size: 25,
                                            color: 'white'
                                        }}
                                        onPress={() => {
                                            this.sendPayment({
                                                payment_request: paymentRequest,
                                                amount: customAmount,
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
                                                max_fee_percent: isCLightning
                                                    ? maxFeePercent
                                                    : null,
                                                outgoing_chan_id:
                                                    outgoingChanId,
                                                last_hop_pubkey: lastHopPubkey,
                                                amp: enableAmp
                                            });
                                        }}
                                    />
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        padding: 20
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
        paddingTop: 15,
        paddingBottom: 15
    }
});
