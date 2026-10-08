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
jest.mock('../utils/UnitsUtils', () => ({ SATS_PER_BTC: 100000000 }));
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
import Receive from './Receive';
import BackendUtils from '../utils/BackendUtils';

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

    it('watches for the sat amount, not the fiat display amount', () => {
        // 10,000 KRW is roughly 7,100 sats: a paid 7,100 sat invoice must
        // satisfy the watcher
        const view = makeView({ value: '10000', satAmount: '7100' });

        view.subscribeInvoice('rhash', 'bc1qwatched');

        expect(BackendUtils.watchInvoicePaid).toHaveBeenCalledWith(
            { rHash: 'rhash', value: '7100' },
            expect.any(Function)
        );
        expect(BackendUtils.watchOnchainReceived).toHaveBeenCalledWith(
            expect.objectContaining({
                address: 'bc1qwatched',
                value: '7100',
                blockHeight: 900000
            }),
            expect.any(Function)
        );
    });

    it('watches for the sat amount when the display unit is BTC', () => {
        const view = makeView({ value: '0.00007100', satAmount: 7100 });

        view.subscribeInvoice('rhash');

        expect(BackendUtils.watchInvoicePaid).toHaveBeenCalledWith(
            { rHash: 'rhash', value: 7100 },
            expect.any(Function)
        );
        expect(BackendUtils.watchOnchainReceived).not.toHaveBeenCalled();
    });
});
