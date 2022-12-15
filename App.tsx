import * as React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Provider } from 'mobx-react';
import Stores from './stores/Stores';
import Navigation from './Navigation';
import { themeColor } from './utils/ThemeUtils';

export default class App extends React.PureComponent {
    render() {
        return (
            <Provider
                BalanceStore={Stores.balanceStore}
                TransactionsStore={Stores.transactionsStore}
                ChannelsStore={Stores.channelsStore}
                NodeInfoStore={Stores.nodeInfoStore}
                InvoicesStore={Stores.invoicesStore}
                SettingsStore={Stores.settingsStore}
                FiatStore={Stores.fiatStore}
                UnitsStore={Stores.unitsStore}
                PaymentsStore={Stores.paymentsStore}
                FeeStore={Stores.feeStore}
                LnurlPayStore={Stores.lnurlPayStore}
                UTXOsStore={Stores.utxosStore}
                MessageSignStore={Stores.messageSignStore}
                ActivityStore={Stores.activityStore}
            >
                <SafeAreaView
                    style={[
                        styles.container,
                        { backgroundColor: themeColor('background') }
                    ]}
                >
                    <Navigation />
                </SafeAreaView>
            </Provider>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    }
});
