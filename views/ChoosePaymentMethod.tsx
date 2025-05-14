import * as React from 'react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../components/Button';
import Header from '../components/Header';
import PaymentMethodList from '../components/LayerBalances/PaymentMethodList';
import Screen from '../components/Screen';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface ChoosePaymentMethodProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'ChoosePaymentMethod',
        {
            value: string;
            satAmount: string;
            lightning: string;
            offer: string;
        }
    >;
}

interface ChoosePaymentMethodState {
    value: string;
    satAmount: string;
    lightning: string;
    offer: string;
}

export default class ChoosePaymentMethod extends React.Component<
    ChoosePaymentMethodProps,
    ChoosePaymentMethodState
> {
    state = {
        value: '',
        satAmount: '',
        lightning: '',
        offer: ''
    };

    componentDidMount() {
        const { route } = this.props;
        const { value, satAmount, lightning, offer } = route.params ?? {};

        if (value) {
            this.setState({ value });
        }

        if (satAmount) {
            this.setState({ satAmount });
        }

        if (lightning) {
            this.setState({ lightning });
        }

        if (offer) {
            this.setState({ offer });
        }
    }

    render() {
        const { navigation } = this.props;
        const { value, satAmount, lightning, offer } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Accounts.select'),
                        style: { color: themeColor('text') }
                    }}
                    navigation={navigation}
                />
                <PaymentMethodList
                    navigation={navigation}
                    // for payment method selection
                    value={value}
                    satAmount={satAmount}
                    lightning={lightning}
                    offer={offer}
                />
                {!!value && !!lightning && (
                    <Button
                        title={localeString('views.Accounts.fetchTxFees')}
                        containerStyle={{
                            margin: 20
                        }}
                        onPress={() =>
                            navigation.navigate('EditFee', {
                                displayOnly: true
                            })
                        }
                    />
                )}
            </Screen>
        );
    }
}
