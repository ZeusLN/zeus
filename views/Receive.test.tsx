jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({
    ButtonGroup: 'ButtonGroup',
    Icon: 'Icon'
}));
jest.mock('react-native-nfc-manager', () => ({ isSupported: jest.fn() }));
jest.mock('../utils/handleAnything', () => jest.fn());
jest.mock('../utils/BackendUtils', () => ({
    watchInvoicePaid: jest.fn(() => jest.fn()),
    watchOnchainReceived: jest.fn(() => jest.fn())
}));
jest.mock('../stores/SettingsStore', () => ({
    TIME_PERIOD_KEYS: [],
    DefaultInvoiceType: { Unified: 'unified', Lightning: 'lightning' }
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../utils/LndUtils', () => ({
    toWalletrpcAddressTypeName: jest.fn()
}));
jest.mock('../utils/NFCUtils', () => ({ scanNfcTag: jest.fn() }));
jest.mock('../utils/UnitsUtils', () => ({
    SATS_PER_BTC: 100000000,
    numberWithCommas: (x: string | number) => `${x}`
}));
jest.mock('../utils/AmountUtils', () => ({ getAmountFromSats: jest.fn() }));
jest.mock('../utils/ExpiryUtils', () => ({
    ExpirationPreset: {},
    TimePeriod: {},
    expirationIndexFromSeconds: jest.fn(),
    expirySecondsFromInput: jest.fn(),
    localizedExpiryDuration: jest.fn()
}));
jest.mock('../components/Amount', () => 'Amount');
jest.mock('../components/AmountInput', () => ({
    __esModule: true,
    default: 'AmountInput',
    getSatAmount: jest.fn()
}));
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/CollapsedQR', () => 'CollapsedQR');
jest.mock('../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/HopPicker', () => 'HopPicker');
jest.mock('../components/KeyValue', () => 'KeyValue');
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/PaidIndicator', () => 'PaidIndicator');
jest.mock('../components/ModalBox', () => 'ModalBox');
jest.mock('../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../components/Screen', () => 'Screen');
jest.mock('../components/SuccessAnimation', () => 'SuccessAnimation');
jest.mock('../components/SuccessErrorMessage', () => ({
    SuccessMessage: 'SuccessMessage',
    WarningMessage: 'WarningMessage',
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../components/Switch', () => 'Switch');
jest.mock('../components/Text', () => 'Text');
jest.mock('../components/TextInput', () => 'TextInput');
jest.mock('../components/layout/Spacer', () => ({ Spacer: 'Spacer' }));
jest.mock('../components/Accordion', () => 'Accordion');
jest.mock('../components/SVG/UnifiedSvg', () => 'UnifiedSvg');
jest.mock('../components/SVG/LightningSvg', () => 'LightningSvg');
jest.mock('../components/SVG/OnChainSvg', () => 'OnChainSvg');
jest.mock('../components/SVG/AddressSvg', () => 'AddressSvg');
jest.mock('../assets/images/SVG/wordmark-black.svg', () => 'Wordmark');
jest.mock('../assets/images/SVG/Caret Down.svg', () => 'CaretDown');
jest.mock('../assets/images/SVG/Caret Right.svg', () => 'CaretRight');
jest.mock('../assets/images/SVG/Lock.svg', () => 'LockIcon');
jest.mock('../assets/images/SVG/Gear.svg', () => 'Gear');
jest.mock('../assets/images/SVG/NFC-alt.svg', () => 'NfcIcon');

import * as React from 'react';
import { Alert } from 'react-native';
import Receive from './Receive';
import BackendUtils from '../utils/BackendUtils';
import handleAnything from '../utils/handleAnything';
import { getSatAmount } from '../components/AmountInput';

// value is in the display unit (here fiat), satAmount in sats, as set by
// AmountInput's onAmountChange
const makeView = (state: { value: string; satAmount: string | number }) => {
    const view = new Receive({
        navigation: { navigate: jest.fn() },
        route: { params: {} },
        SettingsStore: { settings: {} },
        NodeInfoStore: { nodeInfo: { block_height: 900000 } }
    } as unknown as React.ComponentProps<typeof Receive>);
    view.state = { ...view.state, ...state };
    return view;
};

describe('Receive.subscribeInvoice', () => {
    beforeEach(() => jest.clearAllMocks());

    it('watches on-chain for the sat amount, not the fiat display amount', () => {
        // 10,000 KRW is roughly 7,100 sats: a 7,100 sat output must
        // satisfy the watcher
        const view = makeView({ value: '10000', satAmount: '7100' });

        view.subscribeInvoice('rhash', 'bc1qwatched');

        expect(BackendUtils.watchOnchainReceived).toHaveBeenCalledWith(
            expect.objectContaining({
                address: 'bc1qwatched',
                expectedAmountSat: '7100',
                blockHeight: 900000
            }),
            expect.any(Function)
        );
    });

    it('watches the invoice by hash alone', () => {
        // with the Flow LSP the node invoice is for the Receive amount
        // minus the LSP fee, so no amount can be passed to compare against
        const view = makeView({ value: '0.00007100', satAmount: 7100 });

        view.subscribeInvoice('rhash');

        expect(BackendUtils.watchInvoicePaid).toHaveBeenCalledWith(
            { rHash: 'rhash' },
            expect.any(Function)
        );
        expect(BackendUtils.watchOnchainReceived).not.toHaveBeenCalled();
    });
});

describe('Receive LNURL-withdraw LSP fee', () => {
    beforeEach(() => jest.clearAllMocks());

    const pressAlertButton = (text: string) => {
        const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
        buttons.find((b: any) => b.text === text).onPress();
    };

    it('shows the fee and the amount left, and resolves with the choice', async () => {
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        const view = makeView({ value: '50000', satAmount: '50000' });

        const declined = view.confirmLspFee(2000, '50000');
        expect((Alert.alert as jest.Mock).mock.calls[0][1]).toBe(
            'views.Receive.lspFeeConfirmWithdrawal'
        );
        pressAlertButton('general.cancel');
        await expect(declined).resolves.toBe(false);

        (Alert.alert as jest.Mock).mockClear();
        const accepted = view.confirmLspFee(2000, '50000');
        pressAlertButton('general.confirm');
        await expect(accepted).resolves.toBe(true);
    });

    it('explains a fee the withdrawal amount does not cover as added on top', async () => {
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        const view = makeView({ value: '1000', satAmount: '1000' });

        const answer = view.confirmLspFee(3000, '1000');
        expect((Alert.alert as jest.Mock).mock.calls[0][1]).toBe(
            'views.Receive.lspFeeOnTopConfirmWithdrawal'
        );
        pressAlertButton('general.confirm');
        await expect(answer).resolves.toBe(true);
    });

    it('passes the confirmation to the store on an NFC withdraw with a keyed-in amount', async () => {
        (getSatAmount as jest.Mock).mockReturnValue(50000);
        (handleAnything as unknown as jest.Mock).mockResolvedValue([
            'Receive',
            { lnurlParams: { defaultDescription: { memo: '' } } }
        ]);
        const createUnifiedInvoice = jest.fn(() => new Promise(() => {}));
        const view = new Receive({
            navigation: { navigate: jest.fn() },
            route: { params: { amount: '50000' } },
            SettingsStore: { settings: {} },
            NodeInfoStore: { nodeInfo: {} },
            InvoicesStore: { createUnifiedInvoice }
        } as unknown as React.ComponentProps<typeof Receive>);
        view.state = { ...view.state, lspIsActive: true };

        view.validateAddress('lnurl1withdraw');
        await new Promise(process.nextTick);

        expect(createUnifiedInvoice).toHaveBeenCalledWith(
            expect.objectContaining({
                useLsp: true,
                confirmLspFee: view.confirmLspFee
            })
        );
    });
});
