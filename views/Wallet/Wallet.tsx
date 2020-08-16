import * as React from 'react';
import { Linking, Text, View } from 'react-native';
import { ButtonGroup } from 'react-native-elements';
import Transactions from './Transactions';
import Payments from './Payments';
import Invoices from './Invoices';
import Channels from './Channels';
import MainPane from './MainPane';
import { inject, observer } from 'mobx-react';
import PrivacyUtils from './../../utils/PrivacyUtils';

import BalanceStore from './../../stores/BalanceStore';
import ChannelsStore from './../../stores/ChannelsStore';
import FeeStore from './../../stores/FeeStore';
import InvoicesStore from './../../stores/InvoicesStore';
import NodeInfoStore from './../../stores/NodeInfoStore';
import PaymentsStore from './../../stores/PaymentsStore';
import SettingsStore from './../../stores/SettingsStore';
import FiatStore from './../../stores/FiatStore';
import TransactionsStore from './../../stores/TransactionsStore';
import UnitsStore from './../../stores/UnitsStore';

import handleAnything from './../../utils/handleAnything';

interface WalletProps {
    enterSetup: any;
    exitTransaction: any;
    navigation: any;
    BalanceStore: BalanceStore;
    ChannelsStore: ChannelsStore;
    FeeStore: FeeStore;
    InvoicesStore: InvoicesStore;
    NodeInfoStore: NodeInfoStore;
    PaymentsStore: PaymentsStore;
    SettingsStore: SettingsStore;
    TransactionsStore: TransactionsStore;
    UnitsStore: UnitsStore;
    FiatStore: FiatStore;
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
    'FeeStore',
    'PaymentsStore',
    'SettingsStore',
    'TransactionsStore',
    'UnitsStore',
    'FiatStore'
)
@observer
export default class Wallet extends React.Component<WalletProps, WalletState> {
    state = {
        units: 'sats',
        selectedIndex: 0
    };

    componentDidMount() {
        Linking.getInitialURL()
            .then(url => {
                if (url) {
                    handleAnything(url).then(([route, props]) => {
                        this.props.navigation.navigate(route, props);
                    });
                }
            })
            .catch(err => console.error('An error occurred', err));
    }

    UNSAFE_componentWillMount = () => {
        this.getSettingsAndRefresh();
    };

    UNSAFE_componentWillReceiveProps = (nextProps: any) => {
        const { navigation } = nextProps;
        const refresh = navigation.getParam('refresh', null);

        if (refresh) {
            this.getSettingsAndRefresh();
        }
    };

    async getSettingsAndRefresh() {
        const {
            SettingsStore,
            NodeInfoStore,
            BalanceStore,
            PaymentsStore,
            InvoicesStore,
            TransactionsStore,
            ChannelsStore
        } = this.props;

        NodeInfoStore.reset();
        BalanceStore.reset();
        PaymentsStore.reset();
        InvoicesStore.reset();
        TransactionsStore.reset();
        ChannelsStore.reset();

        await SettingsStore.getSettings().then(() => {
            this.refresh();
        });
    }

    refresh = () => {
        const {
            NodeInfoStore,
            BalanceStore,
            TransactionsStore,
            ChannelsStore,
            InvoicesStore,
            PaymentsStore,
            FeeStore,
            SettingsStore,
            FiatStore
        } = this.props;
        const {
            settings,
            implementation,
            username,
            password,
            login
        } = SettingsStore;
        const { fiat } = settings;

        if (implementation === 'lndhub') {
            login({ login: username, password }).then(() => {
                BalanceStore.getLightningBalance();
                PaymentsStore.getPayments();
                InvoicesStore.getInvoices();
            });
        } else {
            NodeInfoStore.getNodeInfo();
            BalanceStore.getBlockchainBalance();
            BalanceStore.getLightningBalance();
            PaymentsStore.getPayments();
            InvoicesStore.getInvoices();
            TransactionsStore.getTransactions();
            ChannelsStore.getChannels();
            FeeStore.getFees();
        }

        if (implementation === 'lnd') {
            FeeStore.getForwardingHistory();
        }

        if (!!fiat && fiat !== 'Disabled') {
            FiatStore.getFiatRates();
        }
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
        const { settings, implementation } = SettingsStore;
        const { theme, lurkerMode } = settings;

        const paymentsCount = (payments && payments.length) || 0;
        const paymentsButtonCount = lurkerMode
            ? PrivacyUtils.hideValue(paymentsCount, 2, true)
            : paymentsCount;

        const invoicesCountValue = invoicesCount || 0;
        const invoicesButtonCount = lurkerMode
            ? PrivacyUtils.hideValue(invoicesCountValue, 2, true)
            : invoicesCountValue;

        const transactionsCount = (transactions && transactions.length) || 0;
        const transactionsButtonCount = lurkerMode
            ? PrivacyUtils.hideValue(transactionsCount, 2, true)
            : transactionsCount;

        const channelsCount = (channels && channels.length) || 0;
        const channelsButtonCount = lurkerMode
            ? PrivacyUtils.hideValue(channelsCount, 2, true)
            : channelsCount;

        const paymentsButton = () => (
            <React.Fragment>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>
                    {paymentsButtonCount}
                </Text>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>
                    Payments
                </Text>
            </React.Fragment>
        );

        const invoicesButton = () => (
            <React.Fragment>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>
                    {invoicesButtonCount}
                </Text>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>
                    Invoices
                </Text>
            </React.Fragment>
        );

        const transactionsButton = () => (
            <React.Fragment>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>
                    {transactionsButtonCount}
                </Text>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>
                    On-chain
                </Text>
            </React.Fragment>
        );

        const channelsButton = () => (
            <React.Fragment>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>
                    {channelsButtonCount}
                </Text>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>
                    Channels
                </Text>
            </React.Fragment>
        );

        const buttons = [
            { element: paymentsButton },
            { element: invoicesButton },
            { element: transactionsButton },
            { element: channelsButton }
        ];

        const lndHubButtons = [
            { element: paymentsButton },
            { element: invoicesButton }
        ];

        const selectedButtons =
            implementation === 'lndhub' ? lndHubButtons : buttons;

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
                        buttons={selectedButtons}
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
                        buttons={selectedButtons}
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
                    <Payments
                        payments={payments}
                        navigation={navigation}
                        refresh={this.refresh}
                        PaymentsStore={PaymentsStore}
                        UnitsStore={UnitsStore}
                        SettingsStore={SettingsStore}
                    />
                )}
                {selectedIndex == 1 && (
                    <Invoices
                        invoices={invoices}
                        navigation={navigation}
                        refresh={this.refresh}
                        InvoicesStore={InvoicesStore}
                        UnitsStore={UnitsStore}
                        SettingsStore={SettingsStore}
                    />
                )}
                {selectedIndex == 2 && (
                    <Transactions
                        transactions={transactions}
                        navigation={navigation}
                        refresh={this.refresh}
                        TransactionsStore={TransactionsStore}
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
