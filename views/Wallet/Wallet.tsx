import * as React from 'react';
import { Text } from 'react-native';
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
    }

    componentWillMount = () => {
        this.getSettingsAndRefresh();
    }

    componentWillReceiveProps = (nextProps: any) => {
        const { navigation } = nextProps;
        const refresh = navigation.getParam('refresh', null);

        if (refresh) {
            this.getSettingsAndRefresh();
        }
    }

    getSettingsAndRefresh = () => {
        const { NodeInfoStore, SettingsStore } = this.props;
        SettingsStore.getSettings().then(() => {
            if (SettingsStore.settings) {
                NodeInfoStore.getNodeInfo()
                this.refresh();
            }
        });
    }

    refresh = () => {
        const { BalanceStore, TransactionsStore, ChannelsStore, InvoicesStore, PaymentsStore } = this.props;
        BalanceStore.getBlockchainBalance();
        BalanceStore.getLightningBalance();
        TransactionsStore.getTransactions();
        PaymentsStore.getPayments();
        InvoicesStore.getInvoices();
        ChannelsStore.getChannels();
    }

    updateIndex = (selectedIndex: number) => {
        this.setState({selectedIndex});
    }

    changeUnits = () => {
        const { units } = this.state;
        this.setState({
            units: units == 'sats' ? 'bitcoin' : 'sats'
        });
    }

    render() {
        const {
            ChannelsStore,
            InvoicesStore,
            NodeInfoStore,
            PaymentsStore,
            TransactionsStore,
            UnitsStore,
            BalanceStore,
            navigation
        } = this.props;
        const { selectedIndex } = this.state;

        const { transactions } = TransactionsStore;
        const { payments } = PaymentsStore;
        const { invoices } = InvoicesStore;
        const { channels } = ChannelsStore;

        const transactionsButton = () => (
            <React.Fragment>
                <Text>{transactions && transactions.length || 0}</Text>
                <Text>Transactions</Text>
            </React.Fragment>
        );

        const paymentsButton = () => (
            <React.Fragment>
                <Text>{payments && payments.length || 0}</Text>
                <Text>LN Payments</Text>
            </React.Fragment>
        );

        const invoicesButton = () => (
            <React.Fragment>
                <Text>{invoices && invoices.length || 0}</Text>
                <Text>Invoices</Text>
            </React.Fragment>
        );

        const channelsButton = () => (
            <React.Fragment>
                <Text>{channels && channels.length || 0}</Text>
                <Text>Channels</Text>
            </React.Fragment>
        );

        const buttons = [
            { element: transactionsButton },
            { element: paymentsButton },
            { element: invoicesButton },
            { element: channelsButton }
        ];

        return (
            <React.Fragment>
                <MainPane
                    navigation={navigation}
                    NodeInfoStore={NodeInfoStore}
                    UnitsStore={UnitsStore}
                    BalanceStore={BalanceStore}
                />

                <ButtonGroup
                    onPress={this.updateIndex}
                    selectedIndex={selectedIndex}
                    buttons={buttons}
                    containerStyle={{
                        height: 50,
                        marginTop: 0,
                        marginLeft: 0,
                        marginRight: 0
                    }}
                />

                {selectedIndex == 0 && <Transactions
                    transactions={transactions}
                    navigation={navigation}
                    refresh={this.refresh}
                    TransactionsStore={TransactionsStore}
                    UnitsStore={UnitsStore}
                />}
                {selectedIndex == 1 && <Payments
                    payments={payments}
                    navigation={navigation}
                    refresh={this.refresh}
                    PaymentsStore={PaymentsStore}
                    UnitsStore={UnitsStore}
                />}
                {selectedIndex == 2 && <Invoices
                    invoices={invoices}
                    navigation={navigation}
                    refresh={this.refresh}
                    InvoicesStore={InvoicesStore}
                    UnitsStore={UnitsStore}
                />}
                {selectedIndex == 3 && <Channels
                    channels={channels}
                    navigation={navigation}
                    refresh={this.refresh}
                    ChannelsStore={ChannelsStore}
                    NodeInfoStore={NodeInfoStore}
                    UnitsStore={UnitsStore}
                />}
            </React.Fragment>
        );
    }
}