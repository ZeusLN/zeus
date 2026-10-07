jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../stores/Stores', () => ({}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../utils/BackendUtils', () => ({}));
jest.mock('../utils/DonationUtils', () => ({}));
jest.mock('../utils/LinkingUtils', () => ({}));
jest.mock('../utils/GraphSyncUtils', () => ({
    clearPendingPaymentData: jest.fn()
}));
jest.mock('../components/AmountInput', () => 'AmountInput');
jest.mock('../components/Amount', () => 'Amount');
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/SwipeButton', () => 'SwipeButton');
jest.mock('../components/Conversion', () => 'Conversion');
jest.mock('../components/FeeLimit', () => 'FeeLimit');
jest.mock('../components/Accordion', () => 'Accordion');
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/HopPicker', () => 'HopPicker');
jest.mock('../components/KeyValue', () => 'KeyValue');
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/Screen', () => 'Screen');
jest.mock('../components/Switch', () => 'Switch');
jest.mock('../components/Text', () => 'Text');
jest.mock('../components/TextInput', () => 'TextInput');
jest.mock('../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage',
    WarningMessage: 'WarningMessage'
}));
jest.mock('@rneui/themed', () => ({ ButtonGroup: 'ButtonGroup' }));
jest.mock('../utils/SleepUtils', () => ({
    // yield to the macrotask queue so the polling loop can't starve the test
    sleep: jest.fn(() => new Promise((resolve) => setImmediate(resolve)))
}));

import PaymentRequest from './PaymentRequest';

const flush = () => new Promise((resolve) => setImmediate(resolve));

const newView = (BalanceStore: any, isLightningReadyToSend: jest.Mock) => {
    const view: any = new (PaymentRequest as any)({
        BalanceStore,
        NodeInfoStore: { isLightningReadyToSend }
    });
    view.isComponentMounted = true;
    // class is not mounted in these tests; apply state updates directly
    view.setState = (update: any) => {
        view.state = { ...view.state, ...update };
    };
    return view;
};

describe('PaymentRequest.checkIfLndReady', () => {
    it('becomes ready once a stale zero balance is refreshed while mounted', async () => {
        const BalanceStore = { lightningBalance: 0 };
        const isReady = jest.fn().mockResolvedValue(true);
        const view = newView(BalanceStore, isReady);

        const polling = view.checkIfLndReady();
        await flush();
        expect(view.state.lightningReadyToSend).toBe(false);
        expect(isReady).not.toHaveBeenCalled();

        // balance refresh lands after the loop started
        BalanceStore.lightningBalance = 50000;
        await polling;

        expect(isReady).toHaveBeenCalled();
        expect(view.state.lightningReadyToSend).toBe(true);
    });

    it('keeps polling when the readiness check rejects', async () => {
        const BalanceStore = { lightningBalance: 50000 };
        const isReady = jest
            .fn()
            .mockRejectedValueOnce(new Error('LND still starting'))
            .mockResolvedValueOnce(true);
        const view = newView(BalanceStore, isReady);

        await view.checkIfLndReady();

        expect(isReady).toHaveBeenCalledTimes(2);
        expect(view.state.lightningReadyToSend).toBe(true);
    });

    it('stops polling when the view unmounts', async () => {
        const BalanceStore = { lightningBalance: 0 };
        const view = newView(BalanceStore, jest.fn());

        const polling = view.checkIfLndReady();
        await flush();
        view.isComponentMounted = false;
        await polling;

        expect(view.state.lightningReadyToSend).toBe(false);
    });
});
