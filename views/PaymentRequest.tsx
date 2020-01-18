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

import InvoicesStore from './../stores/InvoicesStore';
import TransactionsStore from './../stores/TransactionsStore';
import UnitsStore from './../stores/UnitsStore';
import SettingsStore from './../stores/SettingsStore';

interface InvoiceProps {
    exitSetup: any;
    navigation: any;
    InvoicesStore: InvoicesStore;
    TransactionsStore: TransactionsStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

interface InvoiceState {
    setCustomAmount: boolean;
    customAmount: string;
}

@inject('InvoicesStore', 'TransactionsStore', 'UnitsStore', 'SettingsStore')
@observer
export default class PaymentRequest extends React.Component<
    InvoiceProps,
    InvoiceState
> {
    state = {
        setCustomAmount: false,
        customAmount: ''
    };

    render() {
        const {
            TransactionsStore,
            InvoicesStore,
            UnitsStore,
            SettingsStore,
            navigation
        } = this.props;
        const { setCustomAmount, customAmount } = this.state;
        const {
            pay_req,
            paymentRequest,
            getPayReqError,
            loading
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

        // c-lightning can only pay custom amounts if the amount is not specified
        const canPayCustomAmount = !(
            implementation === 'c-lightning-REST' &&
            (!!requestAmount || requestAmount !== 0)
        );

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
                        text: 'Lightning Invoice',
                        style: { color: '#fff' }
                    }}
                    backgroundColor={
                        theme === 'dark' ? '#261339' : 'rgba(92, 99,216, 1)'
                    }
                />

                {loading && <ActivityIndicator size="large" color="#0000ff" />}

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
                                Error loading invoice: ${getPayReqError}
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
                                        Custom Amount (in satoshis)
                                    </Text>
                                )}
                                {setCustomAmount && (
                                    <TextInput
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
                                                    ? 'Pay default amount'
                                                    : 'Pay custom amount'
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

                            {!!description && (
                                <React.Fragment>
                                    <Text
                                        style={
                                            theme === 'dark'
                                                ? styles.labelDark
                                                : styles.label
                                        }
                                    >
                                        Description:
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
                                        Timestamp:
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
                                        Expiry:
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
                                        CLTV Expiry:
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
                                        Destination:
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
                                        Payment Hash:
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
                                    if (setCustomAmount && customAmount) {
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
        flex: 1
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
    }
});
