import * as React from 'react';
import {
    StyleSheet,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Header, Icon } from 'react-native-elements';
import Payment from './../models/Payment';
import { inject, observer } from 'mobx-react';

import UnitsStore from './../stores/UnitsStore';
import SettingsStore from './../stores/SettingsStore';
import LnurlPayStore from './../stores/LnurlPayStore';
import LnurlPayHistorical from './LnurlPay/Historical';

interface PaymentProps {
    navigation: any;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
    LnurlPayStore: LnurlPayStore;
}

@inject('UnitsStore', 'SettingsStore', 'LnurlPayStore')
@observer
export default class PaymentView extends React.Component<PaymentProps> {
    render() {
        const {
            navigation,
            UnitsStore,
            SettingsStore,
            LnurlPayStore
        } = this.props;
        const { changeUnits, getAmount, units } = UnitsStore;
        const { settings } = SettingsStore;
        const { theme } = settings;

        const payment: Payment = navigation.getParam('payment', null);
        const {
            getCreationTime,
            fee,
            payment_hash,
            value,
            payment_preimage,
            path
        } = payment;
        const date = getCreationTime;
        const lnurlpaytx = LnurlPayStore.load(payment_hash);

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <ScrollView
                style={
                    theme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: 'Payment',
                        style: { color: '#fff' }
                    }}
                    backgroundColor={theme === 'dark' ? '#261339' : 'black'}
                />
                <View style={styles.center}>
                    <TouchableOpacity onPress={() => changeUnits()}>
                        <Text
                            style={{
                                color: 'red',
                                fontSize: 30,
                                fontWeight: 'bold'
                            }}
                        >
                            {getAmount(payment.getAmount)}
                        </Text>
                    </TouchableOpacity>
                </View>

                {lnurlpaytx && (
                    <View style={styles.content}>
                        <LnurlPayHistorical
                            navigation={navigation}
                            lnurlpaytx={lnurlpaytx}
                            preimage={payment_preimage}
                        />
                    </View>
                )}

                <View style={styles.content}>
                    {fee && (
                        <View>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Fee:
                            </Text>
                            <TouchableOpacity onPress={() => changeUnits()}>
                                <Text
                                    style={
                                        theme === 'dark'
                                            ? styles.valueDark
                                            : styles.value
                                    }
                                >
                                    {units && getAmount(fee)}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Payment Hash
                    </Text>
                    <Text
                        style={
                            theme === 'dark' ? styles.valueDark : styles.value
                        }
                    >
                        {payment_hash}
                    </Text>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Payment Pre-Image
                    </Text>
                    <Text
                        style={
                            theme === 'dark' ? styles.valueDark : styles.value
                        }
                    >
                        {payment_preimage}
                    </Text>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Creation Date:
                    </Text>
                    <Text
                        style={
                            theme === 'dark' ? styles.valueDark : styles.value
                        }
                    >
                        {date}
                    </Text>

                    {path && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            {path.length > 1 ? 'Paths:' : 'Path:'}
                        </Text>
                    )}
                    {path && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.valueDark
                                    : styles.value
                            }
                        >
                            {path.join(', ')}
                        </Text>
                    )}
                </View>
            </ScrollView>
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
        paddingLeft: 20,
        paddingRight: 20
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
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
    valueWithLink: {
        paddingBottom: 5,
        color: 'rgba(92, 99,216, 1)'
    }
});
