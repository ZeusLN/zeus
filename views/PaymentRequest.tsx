import * as React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon } from 'react-native-elements';

import { Amount } from './../components/Amount';
import HopPicker from './../components/HopPicker';
import KeyValue from './../components/KeyValue';
import LoadingIndicator from './../components/LoadingIndicator';
import TextInput from './../components/TextInput';

import InvoicesStore from './../stores/InvoicesStore';
import TransactionsStore from './../stores/TransactionsStore';
import UnitsStore from './../stores/UnitsStore';
import ChannelsStore from './../stores/ChannelsStore';
import SettingsStore from './../stores/SettingsStore';

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
    enableMultiPathPayment: boolean;
    enableAtomicMultiPathPayment: boolean;
    maxParts: string;
    maxShardAmt: string;
    timeoutSeconds: string;
    feeLimitSat: string;
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
        enableMultiPathPayment: false,
        enableAtomicMultiPathPayment: false,
        maxParts: '16',
        maxShardAmt: '',
        timeoutSeconds: '20',
        feeLimitSat: '',
        outgoingChanId: null,
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
            outgoingChanId,
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
                onPress={() => navigation.navigate('Wallet', { refresh: true })}
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

                    {!!pay_req && (
                        <View style={styles.content}>
                            <View style={styles.center}>
                                <Amount
                                    sats={requestAmount || 0}
                                    jumboText
                                    toggleable
                                />
                            </View>

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

                            {!!successProbability && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.successProbability'
                                    )}
                                    value={`${successProbability}%`}
                                />
                            )}

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
                                                fee_limit_sat: ampOrMppEnabled
                                                    ? feeLimitSat
                                                    : null,
                                                outgoing_chan_id:
                                                    outgoingChanId,
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
