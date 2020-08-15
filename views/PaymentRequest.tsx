import * as React from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon } from 'react-native-elements';
import { localeString } from './../utils/LocaleUtils';

import InvoicesStore from './../stores/InvoicesStore';
import TransactionsStore from './../stores/TransactionsStore';
import UnitsStore from './../stores/UnitsStore';
import NodeInfoStore from './../stores/NodeInfoStore';
import SettingsStore from './../stores/SettingsStore';
import RESTUtils from './../utils/RESTUtils';

interface InvoiceProps {
    exitSetup: any;
    navigation: any;
    InvoicesStore: InvoicesStore;
    TransactionsStore: TransactionsStore;
    UnitsStore: UnitsStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
}

interface InvoiceState {
    setCustomAmount: boolean;
    customAmount: string;
    enableMultiPathPayment: boolean;
    maxParts: string;
    timeoutSeconds: string;
    feeLimitSat: string;
}

@inject(
    'InvoicesStore',
    'TransactionsStore',
    'UnitsStore',
    'NodeInfoStore',
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
        maxParts: '2',
        timeoutSeconds: '20',
        feeLimitSat: '10'
    };

    render() {
        const {
            TransactionsStore,
            InvoicesStore,
            UnitsStore,
            SettingsStore,
            NodeInfoStore,
            navigation
        } = this.props;
        const { nodeInfo } = NodeInfoStore;
        const {
            setCustomAmount,
            customAmount,
            enableMultiPathPayment,
            maxParts,
            timeoutSeconds,
            feeLimitSat
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

        const date = new Date(Number(timestamp) * 1000).toString();

        const { settings, implementation } = SettingsStore;
        const { theme } = settings;

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
            <View
                style={
                    theme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.PaymentRequest.title'),
                        style: { color: '#fff' }
                    }}
                    backgroundColor={
                        theme === 'dark' ? '#261339' : 'rgba(92, 99,216, 1)'
                    }
                />

                {(loading || loadingFeeEstimate) && (
                    <ActivityIndicator size="large" color="#0000ff" />
                )}

                <ScrollView>
                    {!!getPayReqError && (
                        <View style={styles.content}>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
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
                                        <Text
                                            style={
                                                theme === 'dark'
                                                    ? styles.amountDark
                                                    : styles.amount
                                            }
                                        >
                                            {units &&
                                                getAmount(requestAmount || 0)}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                {setCustomAmount && (
                                    <Text
                                        style={{
                                            color:
                                                theme === 'dark'
                                                    ? 'white'
                                                    : 'black'
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
                                        style={
                                            theme === 'dark'
                                                ? styles.textInputDark
                                                : styles.textInput
                                        }
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
                                                color:
                                                    theme === 'dark'
                                                        ? 'black'
                                                        : 'white'
                                            }}
                                            onPress={() => {
                                                this.setState({
                                                    setCustomAmount: !setCustomAmount
                                                });
                                            }}
                                            style={styles.button}
                                            titleStyle={{
                                                color:
                                                    theme === 'dark'
                                                        ? 'black'
                                                        : 'white'
                                            }}
                                            buttonStyle={{
                                                backgroundColor:
                                                    theme === 'dark'
                                                        ? 'white'
                                                        : 'black',
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
                                        <Text
                                            style={
                                                theme === 'dark'
                                                    ? styles.labelDark
                                                    : styles.label
                                            }
                                        >
                                            {localeString(
                                                'views.PaymentRequest.feeEstimate'
                                            )}
                                            :
                                        </Text>
                                        <Text
                                            style={
                                                theme === 'dark'
                                                    ? styles.valueDark
                                                    : styles.value
                                            }
                                        >
                                            {units && getAmount(feeEstimate)}
                                        </Text>
                                    </TouchableOpacity>
                                </React.Fragment>
                            )}

                            {!!successProbability && (
                                <React.Fragment>
                                    <Text
                                        style={
                                            theme === 'dark'
                                                ? styles.labelDark
                                                : styles.label
                                        }
                                    >
                                        {localeString(
                                            'views.PaymentRequest.successProbability'
                                        )}
                                        :
                                    </Text>
                                    <Text
                                        style={
                                            theme === 'dark'
                                                ? styles.valueDark
                                                : styles.value
                                        }
                                    >
                                        {`${successProbability}%`}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!description && (
                                <React.Fragment>
                                    <Text
                                        style={
                                            theme === 'dark'
                                                ? styles.labelDark
                                                : styles.label
                                        }
                                    >
                                        {localeString(
                                            'views.PaymentRequest.description'
                                        )}
                                        :
                                    </Text>
                                    <Text
                                        style={
                                            theme === 'dark'
                                                ? styles.valueDark
                                                : styles.value
                                        }
                                    >
                                        {description}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!timestamp && (
                                <React.Fragment>
                                    <Text
                                        style={
                                            theme === 'dark'
                                                ? styles.labelDark
                                                : styles.label
                                        }
                                    >
                                        {localeString(
                                            'views.PaymentRequest.timestamp'
                                        )}
                                        :
                                    </Text>
                                    <Text
                                        style={
                                            theme === 'dark'
                                                ? styles.valueDark
                                                : styles.value
                                        }
                                    >
                                        {date}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!expiry && (
                                <React.Fragment>
                                    <Text
                                        style={
                                            theme === 'dark'
                                                ? styles.labelDark
                                                : styles.label
                                        }
                                    >
                                        {localeString(
                                            'views.PaymentRequest.expiry'
                                        )}
                                        :
                                    </Text>
                                    <Text
                                        style={
                                            theme === 'dark'
                                                ? styles.valueDark
                                                : styles.value
                                        }
                                    >
                                        {expiry}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!cltv_expiry && (
                                <React.Fragment>
                                    <Text
                                        style={
                                            theme === 'dark'
                                                ? styles.labelDark
                                                : styles.label
                                        }
                                    >
                                        {localeString(
                                            'views.PaymentRequest.cltvExpiry'
                                        )}
                                        :
                                    </Text>
                                    <Text
                                        style={
                                            theme === 'dark'
                                                ? styles.valueDark
                                                : styles.value
                                        }
                                    >
                                        {cltv_expiry}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!destination && (
                                <React.Fragment>
                                    <Text
                                        style={
                                            theme === 'dark'
                                                ? styles.labelDark
                                                : styles.label
                                        }
                                    >
                                        {localeString(
                                            'views.PaymentRequest.destination'
                                        )}
                                        :
                                    </Text>
                                    <Text
                                        style={
                                            theme === 'dark'
                                                ? styles.valueDark
                                                : styles.value
                                        }
                                    >
                                        {destination}
                                    </Text>
                                </React.Fragment>
                            )}

                            {!!payment_hash && (
                                <React.Fragment>
                                    <Text
                                        style={
                                            theme === 'dark'
                                                ? styles.labelDark
                                                : styles.label
                                        }
                                    >
                                        {localeString(
                                            'views.PaymentRequest.paymentHash'
                                        )}
                                        :
                                    </Text>
                                    <Text
                                        style={
                                            theme === 'dark'
                                                ? styles.valueDark
                                                : styles.value
                                        }
                                    >
                                        {payment_hash}
                                    </Text>
                                </React.Fragment>
                            )}
                        </View>
                    )}

                    <View>
                        <Text>{RESTUtils.supportsMPP()}</Text>
                    </View>

                    {!!pay_req && RESTUtils.supportsMPP() && (
                        <View style={styles.button}>
                            <Button
                                title={
                                    enableMultiPathPayment
                                        ? localeString(
                                              'views.PaymentRequest.disableMpp'
                                          )
                                        : localeString(
                                              'views.PaymentRequest.enableMpp'
                                          )
                                }
                                icon={{
                                    name: 'call-split',
                                    size: 25,
                                    color: 'white'
                                }}
                                onPress={() => {
                                    this.setState({
                                        enableMultiPathPayment: !enableMultiPathPayment
                                    });
                                }}
                                buttonStyle={{
                                    backgroundColor: enableMultiPathPayment
                                        ? 'red'
                                        : 'green',
                                    borderRadius: 30
                                }}
                            />
                        </View>
                    )}

                    {enableMultiPathPayment && (
                        <View style={styles.mppForm}>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {localeString('views.PaymentRequest.maxParts')}:
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
                                style={
                                    theme === 'dark'
                                        ? styles.textInputDark
                                        : styles.textInput
                                }
                                placeholderTextColor="gray"
                            />
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {localeString(
                                    'views.PaymentRequest.maxPartsDescription'
                                )}
                                :
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {localeString('views.PaymentRequest.timeout')}:
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
                                style={
                                    theme === 'dark'
                                        ? styles.textInputDark
                                        : styles.textInput
                                }
                                placeholderTextColor="gray"
                            />
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {localeString('views.PaymentRequest.feeLimit')}:
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
                                style={
                                    theme === 'dark'
                                        ? styles.textInputDark
                                        : styles.textInput
                                }
                                placeholderTextColor="gray"
                            />
                        </View>
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
                                    if (
                                        enableMultiPathPayment &&
                                        setCustomAmount &&
                                        customAmount
                                    ) {
                                        TransactionsStore.sendPayment(
                                            paymentRequest,
                                            customAmount,
                                            null,
                                            maxParts,
                                            timeoutSeconds,
                                            feeLimitSat
                                        );
                                    } else if (enableMultiPathPayment) {
                                        TransactionsStore.sendPayment(
                                            paymentRequest,
                                            null,
                                            null,
                                            maxParts,
                                            timeoutSeconds,
                                            feeLimitSat
                                        );
                                    } else if (
                                        setCustomAmount &&
                                        customAmount
                                    ) {
                                        TransactionsStore.sendPayment(
                                            paymentRequest,
                                            customAmount
                                        );
                                    } else {
                                        TransactionsStore.sendPayment(
                                            paymentRequest
                                        );
                                    }

                                    navigation.navigate('SendingLightning');
                                }}
                                buttonStyle={{
                                    backgroundColor: 'orange',
                                    borderRadius: 30
                                }}
                            />
                        </View>
                    )}
                </ScrollView>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1,
        backgroundColor: 'white'
    },
    darkThemeStyle: {
        flex: 1,
        backgroundColor: 'black',
        color: 'white'
    },
    content: {
        padding: 20
    },
    label: {
        paddingTop: 5
    },
    value: {
        paddingBottom: 5
    },
    labelDark: {
        paddingTop: 5,
        color: 'white'
    },
    valueDark: {
        paddingBottom: 5,
        color: 'white'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15,
        paddingLeft: 10,
        paddingRight: 10
    },
    amount: {
        fontSize: 25,
        fontWeight: 'bold'
    },
    amountDark: {
        fontSize: 25,
        fontWeight: 'bold',
        color: 'white'
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    },
    textInput: {
        fontSize: 20,
        color: 'black'
    },
    textInputDark: {
        fontSize: 20,
        color: 'white'
    },
    mppForm: {
        paddingLeft: 20,
        paddingBottom: 10
    }
});
