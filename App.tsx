import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import Stores from './stores/Stores';
import Navigation from './Navigation';
import { Provider } from 'mobx-react';

export default class App extends React.PureComponent {
    render() {
        return (
            <Provider
                BalanceStore={Stores.walletStore}
                TransactionsStore={Stores.transactionsStore}
                ChannelsStore={Stores.channelsStore}
                NodeInfoStore={Stores.nodeInfoStore}
                InvoicesStore={Stores.invoicesStore}
                SettingsStore={Stores.settingsStore}
                UnitsStore={Stores.unitsStore}
                PaymentsStore={Stores.paymentsStore}
                FeeStore={Stores.feeStore}
            >
                <View style={styles.container}>
                    <Navigation />
                </View>
            </Provider>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    }
});
