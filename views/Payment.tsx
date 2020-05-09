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
import PrivacyUtils from './../utils/PrivacyUtils';

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
        const { theme, lurkerMode } = settings;

        const payment: Payment = navigation.getParam('payment', null);
        const {
            getCreationTime,
            getFee,
            payment_hash,
            payment_preimage,
            enhancedPath
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

        const amount = lurkerMode
            ? PrivacyUtils.hideValue(getAmount(payment.getAmount), 8, true)
            : getAmount(payment.getAmount);
        const fee = lurkerMode
            ? PrivacyUtils.hideValue(getAmount(getFee), 3, true)
            : getAmount(getFee);

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
                            {units && amount}
                        </Text>
                    </TouchableOpacity>
                </View>

                {lnurlpaytx && (
                    <View style={styles.content}>
                        <LnurlPayHistorical
                            navigation={navigation}
                            lnurlpaytx={lnurlpaytx}
                            preimage={payment_preimage}
                            SettingsStore={SettingsStore}
                        />
                    </View>
                )}

                <View style={styles.content}>
                    {getFee && (
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
                                    {units && fee}
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
                        {lurkerMode
                            ? PrivacyUtils.hideValue(payment_hash)
                            : payment_hash}
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
                        {lurkerMode
                            ? PrivacyUtils.hideValue(payment_preimage)
                            : payment_preimage}
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
                        {lurkerMode ? PrivacyUtils.hideValue(date, 14) : date}
                    </Text>

                    {enhancedPath.length > 0 && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            Path:
                        </Text>
                    )}
                    {enhancedPath.length > 0 && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.valueDark
                                    : styles.value
                            }
                            selectable
                        >
                            {lurkerMode
                                ? PrivacyUtils.hideValue(
                                      enhancedPath.join(', ')
                                  )
                                : enhancedPath.join(', ')}
                        </Text>
                    )}
                </View>
            </ScrollView>
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
