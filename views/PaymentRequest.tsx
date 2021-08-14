import * as React from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
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
    setCustomAmount: boolean;
    customAmount: string;
    enableMultiPathPayment: boolean;
    enableAtomicMultiPathPayment: boolean;
    maxParts: string;
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
        setCustomAmount: false,
        customAmount: '',
        enableMultiPathPayment: false,
        enableAtomicMultiPathPayment: false,
        maxParts: '2',
        timeoutSeconds: '20',
        feeLimitSat: '10',
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
            setCustomAmount,
            customAmount,
            enableMultiPathPayment,
            enableAtomicMultiPathPayment,
            maxParts,
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
        const ampOrMppEnabled: boolean =
            enableMultiPathPayment || enableAtomicMultiPathPayment;

        const requestAmount = pay_req && pay_req.getRequestAmount;
        const expiry = pay_req && pay_req.expiry;
        const cltv_expiry = pay_req && pay_req.cltv_expiry;
        const destination = pay_req && pay_req.destination;
        const description = pay_req && pay_req.description;
        const payment_hash = pay_req && pay_req.payment_hash;
        const timestamp = pay_req && pay_req.timestamp;

        const date = new Date(Number(timestamp) * 1000).toString();

        const { implementation, enableTor } = SettingsStore;

        const isLnd: boolean = implementation === 'lnd';

        // c-lightning can only pay custom amounts if the amount is not specified
        const canPayCustomAmount: boolean =
            isLnd || !requestAmount || requestAmount === 0;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Send')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View style={styles.scrollView}>
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
                            <Text style={styles.label}>
                                {localeString('views.PaymentRequest.error')}:{' '}
                                {getPayReqError}
                            </Text>
                        </View>
                    )}

                    {!!pay_req && (
                        <View style={styles.content}>
                            <View style={styles.center}>
                                {!setCustomAmount && (
                                    <TouchableOpacity
                                        onPress={() => changeUnits()}
                                    >
                                        <Text style={styles.amount}>
                                            {units &&
                                                getAmount(requestAmount || 0)}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                {setCustomAmount && (
                                    <Text
                                        style={{
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.PaymentRequest.customAmt'
                                        )}
                                    </Text>
                                )}
                                {setCustomAmount && (
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
                                        style={styles.textInput}
                                        placeholderTextColor="gray"
                                    />
                                )}
                                {canPayCustomAmount && (
                                    <View style={styles.button}>
                                        <Button
                                            title={
                                                setCustomAmount
                                                    ? localeString(
                                                          'views.PaymentRequest.payDefault'
                                                      )
                                                    : localeString(
                                                          'views.PaymentRequest.payCustom'
                                                      )
                                            }
                                            icon={{
                                                name: 'edit',
                                                size: 25,
                                                color: themeColor('background')
                                            }}
                                            onPress={() => {
                                                if (setCustomAmount) {
                                                    this.setState({
                                                        setCustomAmount: false,
                                                        customAmount: ''
                                                    });
                                                } else {
                                                    this.setState({
                                                        setCustomAmount: true
                                                    });
                                                }
                                            }}
                                            style={styles.button}
                                            titleStyle={{
                                                color: themeColor('background')
                                            }}
                                            buttonStyle={{
                                                backgroundColor: themeColor(
                                                    'text'
                                                ),
                                                borderRadius: 30
                                            }}
                                        />
                                    </View>
                                )}
                            </View>

                            {(!!feeEstimate || feeEstimate === 0) && (
                                <React.Fragment>
                                    <TouchableOpacity
                                        onPress={() => changeUnits()}
                                    >
                                        <Text style={styles.label}>
                                            {localeString(
                                                'views.PaymentRequest.feeEstimate'
                                            )}
                                            :
                                        </Text>
                                        <Text style={styles.value}>
                                            {units && getAmount(feeEstimate)}
                                        </Text>
                                    </TouchableOpacity>
                                </React.Fragment>
                            )}

                            {!!successProbability && (
                                <React.Fragment>
                                    <Text style={styles.label}>
                                        {localeString(
                                            'views.PaymentRequest.successProbability'
                                        )}
                                        :
                                    </Text>
                                    <Text style={styles.value}>
                                        {`${successProbability}%`}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!description && (
                                <React.Fragment>
                                    <Text style={styles.label}>
                                        {localeString(
                                            'views.PaymentRequest.description'
                                        )}
                                        :
                                    </Text>
                                    <Text style={styles.value}>
                                        {description}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!timestamp && (
                                <React.Fragment>
                                    <Text style={styles.label}>
                                        {localeString(
                                            'views.PaymentRequest.timestamp'
                                        )}
                                        :
                                    </Text>
                                    <Text style={styles.value}>{date}</Text>
                                </React.Fragment>
                            )}

                            {!!expiry && (
                                <React.Fragment>
                                    <Text style={styles.label}>
                                        {localeString(
                                            'views.PaymentRequest.expiry'
                                        )}
                                        :
                                    </Text>
                                    <Text style={styles.value}>{expiry}</Text>
                                </React.Fragment>
                            )}

                            {!!cltv_expiry && (
                                <React.Fragment>
                                    <Text style={styles.label}>
                                        {localeString(
                                            'views.PaymentRequest.cltvExpiry'
                                        )}
                                        :
                                    </Text>
                                    <Text style={styles.value}>
                                        {cltv_expiry}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!destination && (
                                <React.Fragment>
                                    <Text style={styles.label}>
                                        {localeString(
                                            'views.PaymentRequest.destination'
                                        )}
                                        :
                                    </Text>
                                    <Text style={styles.value}>
                                        {destination}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!payment_hash && (
                                <React.Fragment>
                                    <Text style={styles.label}>
                                        {localeString(
                                            'views.PaymentRequest.paymentHash'
                                        )}
                                        :
                                    </Text>
                                    <Text style={styles.value}>
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
                                        value={enableAtomicMultiPathPayment}
                                        onValueChange={() =>
                                            this.setState({
                                                enableAtomicMultiPathPayment: !enableAtomicMultiPathPayment
                                            })
                                        }
                                        trackColor={{
                                            false: '#767577',
                                            true: themeColor('highlight')
                                        }}
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
                                                    enableMultiPathPayment: !enableMultiPathPayment
                                                })
                                            }
                                            trackColor={{
                                                false: '#767577',
                                                true: themeColor('highlight')
                                            }}
                                        />
                                    </React.Fragment>
                                )}

                            {(enableMultiPathPayment ||
                                enableAtomicMultiPathPayment) && (
                                <React.Fragment>
                                    <Text style={styles.label}>
                                        {localeString(
                                            'views.PaymentRequest.maxParts'
                                        )}
                                        :
                                    </Text>
                                    <TextInput
                                        keyboardType="numeric"
                                        placeholder="2 (or greater)"
                                        value={maxParts}
                                        onChangeText={(text: string) =>
                                            this.setState({
                                                maxParts: text
                                            })
                                        }
                                        numberOfLines={1}
                                        style={styles.textInput}
                                        placeholderTextColor="gray"
                                    />
                                    <Text style={styles.label}>
                                        {localeString(
                                            'views.PaymentRequest.maxPartsDescription'
                                        )}
                                    </Text>
                                    <Text style={styles.label}>
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
                                        numberOfLines={1}
                                        style={styles.textInput}
                                        placeholderTextColor="gray"
                                    />
                                    <Text style={styles.label}>
                                        {localeString(
                                            'views.PaymentRequest.feeLimit'
                                        )}
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
                                        numberOfLines={1}
                                        style={styles.textInput}
                                        placeholderTextColor="gray"
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
                                            TransactionsStore.sendPayment(
                                                paymentRequest,
                                                customAmount,
                                                null,
                                                ampOrMppEnabled
                                                    ? maxParts
                                                    : null,
                                                ampOrMppEnabled
                                                    ? timeoutSeconds
                                                    : null,
                                                ampOrMppEnabled
                                                    ? feeLimitSat
                                                    : null,
                                                outgoingChanIds,
                                                lastHopPubkey,
                                                enableAtomicMultiPathPayment
                                            );

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
    scrollView: {
        flex: 1,
        backgroundColor: themeColor('background'),
        color: themeColor('text')
    },
    content: {
        padding: 20
    },
    label: {
        paddingTop: 5,
        color: themeColor('text')
    },
    value: {
        paddingBottom: 5,
        color: themeColor('text')
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15,
        paddingLeft: 10,
        paddingRight: 10
    },
    amount: {
        fontSize: 25,
        fontWeight: 'bold',
        color: themeColor('text')
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    },
    textInput: {
        fontSize: 20,
        color: themeColor('text')
    },
    mppForm: {
        paddingLeft: 20,
        paddingBottom: 10
    }
});
