import * as React from 'react';
import { Provider } from 'mobx-react';
import Stores from './stores/Stores';
import Navigation from './Navigation';
import { AppContainer } from './components/layout/AppContainer';
import ExternalLinkModal from './components/Modals/ExternalLinkModal';
import AndroidNfcModal from './components/Modals/AndroidNfcModal';

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
                PosStore={Stores.posStore}
                ModalStore={Stores.modalStore}
                NotesStore={Stores.NotesStore}
            >
                <AppContainer>
                    <Navigation />
                    <ExternalLinkModal />
                    <AndroidNfcModal />
                </AppContainer>
            </Provider>
        );
    }
}
