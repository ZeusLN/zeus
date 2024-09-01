import * as React from 'react';
import { TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import LayerBalances from '../../components/LayerBalances';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import { Row } from '../../components/layout/Row';

import BalanceStore from '../../stores/BalanceStore';
import UnitsStore from '../../stores/UnitsStore';
import UTXOsStore from '../../stores/UTXOsStore';
import SettingsStore from '../../stores/SettingsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Add from '../../assets/images/SVG/Add.svg';
import Filter from '../../assets/images/SVG/Filter On.svg';

interface AccountsProps {
    navigation: StackNavigationProp<any, any>;
    BalanceStore: BalanceStore;
    UTXOsStore: UTXOsStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
    route: Route<
        'Accounts',
        {
            value: string;
            amount: string;
            lightning: string;
            offer: string;
            locked: boolean;
        }
    >;
}

interface AccountsState {
    value: string;
    amount: string;
    lightning: string;
    offer: string;
    locked: boolean;
    editMode: boolean;
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
        lightning: '',
        offer: '',
        locked: false,
        editMode: false
    };

    UNSAFE_componentWillMount() {
        const { UTXOsStore } = this.props;
        if (BackendUtils.supportsAccounts()) UTXOsStore.listAccounts();
    }

    componentDidMount() {
        const { route } = this.props;
        const { value, amount, lightning, offer, locked } = route.params ?? {};

        if (value) {
            this.setState({ value });
        }

        if (amount) {
            this.setState({ amount });
        }

        if (lightning) {
            this.setState({ lightning });
        }

        if (offer) {
            this.setState({ offer });
        }

        if (locked) {
            this.setState({ locked });
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
        const { value, amount, lightning, offer, locked, editMode } =
            this.state;
        const { loadingAccounts, accounts } = UTXOsStore;

        const FilterButton = () => (
            <TouchableOpacity
                onPress={() => {
                    this.setState({
                        editMode: !editMode
                    });
                }}
            >
                <Filter
                    style={{ alignSelf: 'center', marginRight: 15 }}
                    fill={themeColor('text')}
                />
            </TouchableOpacity>
        );

        const AddButton = () => (
            <TouchableOpacity
                onPress={() => navigation.navigate('ImportAccount')}
                accessibilityLabel={localeString('general.add')}
            >
                <Add
                    fill={themeColor('text')}
                    width="30"
                    height="30"
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: amount
                            ? localeString('views.Accounts.select')
                            : localeString('views.Accounts.title'),
                        style: { color: themeColor('text') }
                    }}
                    rightComponent={
                        value ? null : (
                            <Row>
                                {accounts.length > 0 && <FilterButton />}
                                <AddButton />
                            </Row>
                        )
                    }
                    navigation={navigation}
                />
                {loadingAccounts && <LoadingIndicator />}
                {!loadingAccounts && (
                    <LayerBalances
                        navigation={navigation}
                        BalanceStore={BalanceStore}
                        UnitsStore={UnitsStore}
                        SettingsStore={SettingsStore}
                        onRefresh={async () =>
                            await Promise.all(
                                BackendUtils.supportsAccounts()
                                    ? [
                                          BalanceStore.getBlockchainBalance(),
                                          BalanceStore.getLightningBalance(),
                                          UTXOsStore.listAccounts()
                                      ]
                                    : [
                                          BalanceStore.getBlockchainBalance(),
                                          BalanceStore.getLightningBalance()
                                      ]
                            )
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
                        offer={offer}
                        locked={locked}
                        editMode={editMode}
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
            </Screen>
        );
    }
}
