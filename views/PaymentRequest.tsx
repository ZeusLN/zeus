import * as React from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon } from 'react-native-elements';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import InvoicesStore from './../stores/InvoicesStore';
import TransactionsStore from './../stores/TransactionsStore';
import UnitsStore from './../stores/UnitsStore';
import ChannelsStore from './../stores/ChannelsStore';
import SettingsStore from './../stores/SettingsStore';
import RESTUtils from './../utils/RESTUtils';

import HopPicker from './../components/HopPicker';
import TextInput from './../components/TextInput';

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
    enableMultiPathPayment: boolean;
    enableAtomicMultiPathPayment: boolean;
    maxParts: string;
    maxShardAmt: string;
    timeoutSeconds: string;
    feeLimitSat: string;
    outgoingChanIds: Array<string> | null;
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
        enableMultiPathPayment: false,
        enableAtomicMultiPathPayment: false,
        maxParts: '16',
        maxShardAmt: '',
        timeoutSeconds: '20',
        feeLimitSat: '',
        outgoingChanIds: null,
        lastHopPubkey: null
    };

    render() {
        const {
            TransactionsStore,
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
            timeoutSeconds,
            feeLimitSat,
            outgoingChanIds,
            lastHopPubkey
        } = this.state;
        const {
            pay_req,
            paymentRequest,
            getPayReqError,
            loading,
            loadingFeeEstimate,
            successProbability,
            feeEstimate
        } = InvoicesStore;
        const { units, changeUnits, getAmount } = UnitsStore;

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
        const ampOrMppEnabled: boolean = enableMultiPathPayment || enableAmp;

        const date = new Date(Number(timestamp) * 1000).toString();

        const { enableTor } = SettingsStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color="#fff"
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
                        style: { color: '#fff' }
                    }}
                    backgroundColor="#1f2328"
                />

                {(loading || loadingFeeEstimate) && (
                    <ActivityIndicator size="large" color="#0000ff" />
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

                    {!!pay_req && (
                        <View style={styles.content}>
                            <View style={styles.center}>
                                <TouchableOpacity onPress={() => changeUnits()}>
                                    <Text
                                        style={{
                                            ...styles.amount,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {units && getAmount(requestAmount || 0)}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {(!!feeEstimate || feeEstimate === 0) && (
                                <React.Fragment>
                                    <TouchableOpacity
                                        onPress={() => changeUnits()}
                                    >
                                        <Text
                                            style={{
                                                ...styles.label,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.PaymentRequest.feeEstimate'
                                            )}
                                            :
                                        </Text>
                                        <Text
                                            style={{
                                                ...styles.value,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {units && getAmount(feeEstimate)}
                                        </Text>
                                    </TouchableOpacity>
                                </React.Fragment>
                            )}

                            {!!successProbability && (
                                <React.Fragment>
                                    <Text
                                        style={{
                                            ...styles.label,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.PaymentRequest.successProbability'
                                        )}
                                        :
                                    </Text>
                                    <Text
                                        style={{
                                            ...styles.value,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {`${successProbability}%`}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!description && (
                                <React.Fragment>
                                    <Text
                                        style={{
                                            ...styles.label,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.PaymentRequest.description'
                                        )}
                                        :
                                    </Text>
                                    <Text
                                        style={{
                                            ...styles.value,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {description}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!timestamp && (
                                <React.Fragment>
                                    <Text
                                        style={{
                                            ...styles.label,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.PaymentRequest.timestamp'
                                        )}
                                        :
                                    </Text>
                                    <Text
                                        style={{
                                            ...styles.value,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {date}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!expiry && (
                                <React.Fragment>
                                    <Text
                                        style={{
                                            ...styles.label,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.PaymentRequest.expiry'
                                        )}
                                        :
                                    </Text>
                                    <Text
                                        style={{
                                            ...styles.value,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {expiry}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!cltv_expiry && (
                                <React.Fragment>
                                    <Text
                                        style={{
                                            ...styles.label,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.PaymentRequest.cltvExpiry'
                                        )}
                                        :
                                    </Text>
                                    <Text
                                        style={{
                                            ...styles.value,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {cltv_expiry}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!destination && (
                                <React.Fragment>
                                    <Text
                                        style={{
                                            ...styles.label,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.PaymentRequest.destination'
                                        )}
                                        :
                                    </Text>
                                    <Text
                                        style={{
                                            ...styles.value,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {destination}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!payment_hash && (
                                <React.Fragment>
                                    <Text
                                        style={{
                                            ...styles.label,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.PaymentRequest.paymentHash'
                                        )}
                                        :
                                    </Text>
                                    <Text
                                        style={{
                                            ...styles.value,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {payment_hash}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!pay_req && RESTUtils.supportsHopPicking() && (
                                <>
                                    {
                                        <HopPicker
                                            onValueChange={(item: any) =>
                                                this.setState({
                                                    outgoingChanIds: item
                                                        ? [item.channelId]
                                                        : null
                                                })
                                            }
                                            title="First Hop"
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
                                            title="Last Hop"
                                            ChannelsStore={ChannelsStore}
                                            UnitsStore={UnitsStore}
                                        />
                                    }
                                </>
                            )}

                            {!!pay_req && RESTUtils.supportsAMP() && (
                                <React.Fragment>
                                    <Text style={{ ...styles.label, top: 25 }}>
                                        {localeString(
                                            'views.PaymentRequest.amp'
                                        )}
                                        :
                                    </Text>
                                    <Switch
                                        value={enableAmp}
                                        onValueChange={() =>
                                            this.setState({
                                                enableAtomicMultiPathPayment:
                                                    !enableAtomicMultiPathPayment
                                            })
                                        }
                                        trackColor={{
                                            false: '#767577',
                                            true: themeColor('highlight')
                                        }}
                                        disabled={lockAtomicMultiPathPayment}
                                    />
                                </React.Fragment>
                            )}

                            {!!pay_req &&
                                RESTUtils.supportsMPP() &&
                                !enableTor && (
                                    <React.Fragment>
                                        <Text
                                            style={{ ...styles.label, top: 25 }}
                                        >
                                            {localeString(
                                                'views.PaymentRequest.mpp'
                                            )}
                                            :
                                        </Text>
                                        <Switch
                                            value={enableMultiPathPayment}
                                            onValueChange={() =>
                                                this.setState({
                                                    enableMultiPathPayment:
                                                        !enableMultiPathPayment
                                                })
                                            }
                                            trackColor={{
                                                false: '#767577',
                                                true: themeColor('highlight')
                                            }}
                                        />
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
                                            'views.PaymentRequest.timeout'
                                        )}
                                        :
                                    </Text>
                                    <TextInput
                                        keyboardType="numeric"
                                        placeholder="20"
                                        value={timeoutSeconds}
                                        onChangeText={(text: string) =>
                                            this.setState({
                                                timeoutSeconds: text
                                            })
                                        }
                                    />
                                    <Text
                                        style={{
                                            ...styles.label,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {enableMultiPathPayment
                                            ? localeString(
                                                  'views.PaymentRequest.maxParts'
                                              )
                                            : `${localeString(
                                                  'views.PaymentRequest.maxParts'
                                              )} (${localeString(
                                                  'general.optional'
                                              )})`}
                                        :
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
                                            ...styles.label,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.PaymentRequest.maxPartsDescription'
                                        )}
                                    </Text>
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
                                        :
                                    </Text>
                                    <TextInput
                                        keyboardType="numeric"
                                        placeholder="100"
                                        value={feeLimitSat}
                                        onChangeText={(text: string) =>
                                            this.setState({
                                                feeLimitSat: text
                                            })
                                        }
                                    />
                                </React.Fragment>
                            )}

                            {enableAmp && (
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
                                        :
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
                                            TransactionsStore.sendPayment({
                                                payment_request: paymentRequest,
                                                max_parts: ampOrMppEnabled
                                                    ? maxParts
                                                    : null,
                                                max_shard_amt: ampOrMppEnabled
                                                    ? maxShardAmt
                                                    : null,
                                                timeout_seconds: ampOrMppEnabled
                                                    ? timeoutSeconds
                                                    : null,
                                                fee_limit_sat: ampOrMppEnabled
                                                    ? feeLimitSat
                                                    : null,
                                                outgoing_chan_ids:
                                                    outgoingChanIds,
                                                last_hop_pubkey: lastHopPubkey,
                                                amp: enableAmp
                                            });

                                            navigation.navigate(
                                                'SendingLightning'
                                            );
                                        }}
                                        buttonStyle={{
                                            backgroundColor: 'orange',
                                            borderRadius: 30
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
        paddingTop: 5
    },
    value: {
        paddingBottom: 5
    },
    button: {
        paddingTop: 30,
        paddingBottom: 15,
        paddingLeft: 10,
        paddingRight: 10
    },
    amount: {
        fontSize: 25,
        fontWeight: 'bold'
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    },
    mppForm: {
        paddingLeft: 20,
        paddingBottom: 10
    }
});
