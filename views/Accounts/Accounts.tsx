import * as React from 'react';
import { View } from 'react-native';

import { Header, Icon } from 'react-native-elements';

import { inject, observer } from 'mobx-react';

import Button from './../../components/Button';
import LayerBalances from './../../components/LayerBalances';
import LoadingIndicator from './../../components/LoadingIndicator';

import BalanceStore from './../../stores/BalanceStore';
import UnitsStore from './../../stores/UnitsStore';
import UTXOsStore from './../../stores/UTXOsStore';
import SettingsStore from './../../stores/SettingsStore';

import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

interface AccountsProps {
    navigation: any;
    BalanceStore: BalanceStore;
    UTXOsStore: UTXOsStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

interface AccountsState {
    value: string;
    amount: string;
    lightning: string;
}

@inject('BalanceStore', 'UTXOsStore', 'UnitsStore', 'SettingsStore')
@observer
export default class Accounts extends React.Component<
    AccountsProps,
    AccountsState
> {
    state = {
        value: '',
        amount: '',
        lightning: ''
    };

    UNSAFE_componentWillMount() {
        const { UTXOsStore } = this.props;
        UTXOsStore.listAccounts();
    }

    componentDidMount() {
        const { navigation } = this.props;
        const value: string = navigation.getParam('value');
        const amount: string = navigation.getParam('amount');
        const lightning: string = navigation.getParam('lightning');

        if (value) {
            this.setState({
                value
            });
        }

        if (amount) {
            this.setState({
                amount
            });
        }

        if (lightning) {
            this.setState({
                lightning
            });
        }
    }

    render() {
        const {
            BalanceStore,
            UnitsStore,
            UTXOsStore,
            SettingsStore,
            navigation
        } = this.props;
        const { value, amount, lightning } = this.state;
        const { loadingAccounts } = UTXOsStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() =>
                    value
                        ? navigation.goBack()
                        : navigation.navigate('Settings', { refresh: true })
                }
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        const AddButton = () => (
            <Icon
                name="add"
                onPress={() => navigation.navigate('ImportAccount')}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={{ flex: 1, backgroundColor: themeColor('background') }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: amount
                            ? localeString('views.Accounts.select')
                            : localeString('views.Accounts.title'),
                        style: { color: themeColor('text') }
                    }}
                    rightComponent={value ? null : <AddButton />}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                {loadingAccounts && <LoadingIndicator />}
                {!loadingAccounts && (
                    <LayerBalances
                        navigation={navigation}
                        BalanceStore={BalanceStore}
                        UnitsStore={UnitsStore}
                        SettingsStore={SettingsStore}
                        onRefresh={async () =>
                            await Promise.all([
                                BalanceStore.getBlockchainBalance(),
                                BalanceStore.getLightningBalance(),
                                UTXOsStore.listAccounts()
                            ])
                        }
                        refreshing={
                            BalanceStore.loadingLightningBalance ||
                            BalanceStore.loadingBlockchainBalance ||
                            UTXOsStore.loadingAccounts
                        }
                        // for payment method selection
                        value={value}
                        amount={amount}
                        lightning={lightning}
                    />
                )}
                {!loadingAccounts && !!value && !!lightning && (
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
            </View>
        );
    }
}
