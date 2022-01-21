import * as React from 'react';
import {
    StyleSheet,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Payment from './../models/Payment';
import PrivacyUtils from './../utils/PrivacyUtils';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

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

const PaymentPath = ({ path }: any) => {
    if (path.length === 1) {
        return path[0];
    }

    const multiPathDisplay: any = [];
    for (let i = 0; i < path.length; i++) {
        multiPathDisplay.push(`Part ${i + 1}/${path.length}`);
        for (let j = 0; j < path[i].length; j++) {
            multiPathDisplay.push(path[i][j]);
        }
        multiPathDisplay.push('');
    }

    return multiPathDisplay.join('\n');
};

@inject('UnitsStore', 'SettingsStore', 'LnurlPayStore')
@observer
export default class PaymentView extends React.Component<PaymentProps> {
    state = {
        lnurlpaytx: null
    };

    async componentDidMount() {
        const { navigation, LnurlPayStore } = this.props;
        const payment: Payment = navigation.getParam('payment', null);
        const lnurlpaytx = await LnurlPayStore.load(payment.payment_hash);
        if (lnurlpaytx) {
            this.setState({ lnurlpaytx });
        }
    }

    render() {
        const { navigation, UnitsStore, SettingsStore } = this.props;
        const { changeUnits, getAmount, units } = UnitsStore;
        const { settings } = SettingsStore;
        const { privacy } = settings;
        const { lurkerMode } = privacy;

        const payment: Payment = navigation.getParam('payment', null);
        const {
            getDisplayTime,
            getFee,
            payment_hash,
            getPreimage,
            enhancedPath
        } = payment;
        const date = getDisplayTime;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        const amount = PrivacyUtils.sensitiveValue(
            getAmount(payment.getAmount),
            8,
            true
        );
        const fee = PrivacyUtils.sensitiveValue(getAmount(getFee), 3, true);

        const lnurlpaytx = this.state.lnurlpaytx;

        return (
            <ScrollView
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Payment.title'),
                        style: { color: '#fff' }
                    }}
                    backgroundColor="#1f2328"
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
                            preimage={getPreimage}
                        />
                    </View>
                )}

                <View style={styles.content}>
                    {getFee && (
                        <View>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Payment.fee')}:
                            </Text>
                            <TouchableOpacity onPress={() => changeUnits()}>
                                <Text
                                    style={{
                                        ...styles.value,
                                        color: themeColor('text')
                                    }}
                                >
                                    {units && fee}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {typeof payment_hash === 'string' && (
                        <>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Payment.paymentHash')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(payment_hash)}
                            </Text>
                        </>
                    )}

                    <Text
                        style={{ ...styles.label, color: themeColor('text') }}
                    >
                        {localeString('views.Payment.paymentPreimage')}:
                    </Text>
                    <Text
                        style={{ ...styles.value, color: themeColor('text') }}
                    >
                        {PrivacyUtils.sensitiveValue(getPreimage)}
                    </Text>

                    <Text
                        style={{ ...styles.label, color: themeColor('text') }}
                    >
                        {localeString('views.Payment.creationDate')}:
                    </Text>
                    <Text
                        style={{ ...styles.value, color: themeColor('text') }}
                    >
                        {PrivacyUtils.sensitiveValue(date, 14)}
                    </Text>

                    {enhancedPath.length > 0 && (
                        <Text
                            style={{
                                ...styles.label,
                                color: themeColor('text')
                            }}
                        >
                            {localeString('views.Payment.path')}:
                        </Text>
                    )}
                    {enhancedPath.length > 0 && (
                        <Text
                            style={{
                                ...styles.value,
                                color: themeColor('text')
                            }}
                            selectable
                        >
                            {lurkerMode ? (
                                PrivacyUtils.sensitiveValue(
                                    enhancedPath.join(', ')
                                )
                            ) : (
                                <PaymentPath path={enhancedPath} />
                            )}
                        </Text>
                    )}
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
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
    valueWithLink: {
        paddingBottom: 5,
        color: 'rgba(92, 99,216, 1)'
    }
});
