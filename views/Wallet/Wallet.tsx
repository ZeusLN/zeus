import * as React from 'react';
import { Text, View } from 'react-native';
import { ButtonGroup } from 'react-native-elements';
import Transactions from './Transactions';
import Payments from './Payments';
import Invoices from './Invoices';
import Channels from './Channels';
import MainPane from './MainPane';
import { inject, observer } from 'mobx-react';

import BalanceStore from './../../stores/BalanceStore';
import ChannelsStore from './../../stores/ChannelsStore';
import InvoicesStore from './../../stores/InvoicesStore';
import NodeInfoStore from './../../stores/NodeInfoStore';
import PaymentsStore from './../../stores/PaymentsStore';
import SettingsStore from './../../stores/SettingsStore';
import TransactionsStore from './../../stores/TransactionsStore';
import UnitsStore from './../../stores/UnitsStore';

interface WalletProps {
    enterSetup: any;
    exitTransaction: any;
    navigation: any;
    BalanceStore: BalanceStore;
    ChannelsStore: ChannelsStore;
    InvoicesStore: InvoicesStore;
    NodeInfoStore: NodeInfoStore;
    PaymentsStore: PaymentsStore;
    SettingsStore: SettingsStore;
    TransactionsStore: TransactionsStore;
    UnitsStore: UnitsStore;
}

interface WalletState {
    units: String;
    selectedIndex: number;
}

@inject(
    'BalanceStore',
    'ChannelsStore',
    'InvoicesStore',
    'NodeInfoStore',
    'PaymentsStore',
    'SettingsStore',
    'TransactionsStore',
    'UnitsStore'
)
@observer
export default class Wallet extends React.Component<WalletProps, WalletState> {
    state = {
        units: 'sats',
        selectedIndex: 0
    };

    componentWillMount = () => {
        this.getSettingsAndRefresh();
    };

    componentWillReceiveProps = (nextProps: any) => {
        const { navigation } = nextProps;
        const refresh = navigation.getParam('refresh', null);

        if (refresh) {
            this.getSettingsAndRefresh();
        }
    };

    getSettingsAndRefresh = () => {
        const { NodeInfoStore, SettingsStore } = this.props;
        SettingsStore.getSettings().then(() => {
            if (SettingsStore.settings) {
                NodeInfoStore.getNodeInfo();
                this.refresh();
            }
        });
    };

    refresh = () => {
        const {
            BalanceStore,
            TransactionsStore,
            ChannelsStore,
            InvoicesStore,
            PaymentsStore
        } = this.props;
        BalanceStore.getBlockchainBalance();
        BalanceStore.getLightningBalance();
        TransactionsStore.getTransactions();
        PaymentsStore.getPayments();
        InvoicesStore.getInvoices();
        ChannelsStore.getChannels();
    };

    updateIndex = (selectedIndex: number) => {
        this.setState({ selectedIndex });
    };

    changeUnits = () => {
        const { units } = this.state;
        this.setState({
            units: units == 'sats' ? 'bitcoin' : 'sats'
        });
    };

    render() {
        const {
            ChannelsStore,
            InvoicesStore,
            NodeInfoStore,
            PaymentsStore,
            TransactionsStore,
            UnitsStore,
            BalanceStore,
            SettingsStore,
            navigation
        } = this.props;
        const { selectedIndex } = this.state;

        const { transactions } = TransactionsStore;
        const { payments } = PaymentsStore;
        const { invoices, invoicesCount } = InvoicesStore;
        const { channels } = ChannelsStore;
        const { settings } = SettingsStore;
        const { theme } = settings;

        const transactionsButton = () => (
            <React.Fragment>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>
                    {(transactions && transactions.length) || 0}
                </Text>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>
                    Transactions
                </Text>
            </React.Fragment>
        );

        const paymentsButton = () => (
            <React.Fragment>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>
                    {(payments && payments.length) || 0}
                </Text>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>
                    LN Payments
                </Text>
            </React.Fragment>
        );

        const invoicesButton = () => (
            <React.Fragment>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>
                    {invoicesCount || 0}
                </Text>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>
                    Invoices
                </Text>
            </React.Fragment>
        );

        const channelsButton = () => (
            <React.Fragment>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>
                    {(channels && channels.length) || 0}
                </Text>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>
                    Channels
                </Text>
            </React.Fragment>
        );

        const buttons = [
            { element: transactionsButton },
            { element: paymentsButton },
            { element: invoicesButton },
            { element: channelsButton }
        ];

        return (
            <View style={{ flex: 1 }}>
                <MainPane
                    navigation={navigation}
                    NodeInfoStore={NodeInfoStore}
                    UnitsStore={UnitsStore}
                    BalanceStore={BalanceStore}
                    SettingsStore={SettingsStore}
                />

                {theme !== 'dark' && (
                    <ButtonGroup
                        onPress={this.updateIndex}
                        selectedIndex={selectedIndex}
                        buttons={buttons}
                        containerStyle={{
                            height: 50,
                            marginTop: 0,
                            marginLeft: 0,
                            marginRight: 0,
                            marginBottom: 0,
                            backgroundColor: '#f2f2f2'
                        }}
                        selectedButtonStyle={{
                            backgroundColor: 'white'
                        }}
                    />
                )}

                {theme === 'dark' && (
                    <ButtonGroup
                        onPress={this.updateIndex}
                        selectedIndex={selectedIndex}
                        buttons={buttons}
                        containerStyle={{
                            height: 50,
                            marginTop: 0,
                            marginLeft: 0,
                            marginRight: 0,
                            marginBottom: 0,
                            backgroundColor: 'black',
                            borderTopWidth: 0,
                            borderLeftWidth: 0,
                            borderRightWidth: 0,
                            borderBottomWidth: 1,
                            borderRadius: 0
                        }}
                        selectedButtonStyle={{
                            backgroundColor: '#261339'
                        }}
                        selectedTextStyle={{
                            color: 'white'
                        }}
                        innerBorderStyle={{
                            color: 'black'
                        }}
                    />
                )}

                {selectedIndex == 0 && (
                    <Transactions
                        transactions={transactions}
                        navigation={navigation}
                        refresh={this.refresh}
                        TransactionsStore={TransactionsStore}
                        UnitsStore={UnitsStore}
                        SettingsStore={SettingsStore}
                    />
                )}
                {selectedIndex == 1 && (
                    <Payments
                        payments={payments}
                        navigation={navigation}
                        refresh={this.refresh}
                        PaymentsStore={PaymentsStore}
                        UnitsStore={UnitsStore}
                        SettingsStore={SettingsStore}
                    />
                )}
                {selectedIndex == 2 && (
                    <Invoices
                        invoices={invoices}
                        navigation={navigation}
                        refresh={this.refresh}
                        InvoicesStore={InvoicesStore}
                        UnitsStore={UnitsStore}
                        SettingsStore={SettingsStore}
                    />
                )}
                {selectedIndex == 3 && (
                    <Channels
                        channels={channels}
                        navigation={navigation}
                        refresh={this.refresh}
                        ChannelsStore={ChannelsStore}
                        NodeInfoStore={NodeInfoStore}
                        UnitsStore={UnitsStore}
                        SettingsStore={SettingsStore}
                    />
                )}
            </View>
        );
    }
}
