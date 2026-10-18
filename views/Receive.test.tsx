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
    supportsOnchainReceiving: () => true,
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

describe('Receive.updateIndex', () => {
    beforeEach(() => jest.clearAllMocks());

    const NEW_ADDRESS = 'bc1qnewaddress';

    // a Lightning-only invoice is on screen and no on-chain address has
    // been generated for it yet
    const makeTabView = (InvoicesStore: any) => {
        const view = new Receive({
            navigation: { navigate: jest.fn() },
            route: { params: {} },
            InvoicesStore: {
                payment_request: 'lnbc100u1example',
                onChainAddress: '',
                getNewAddress: jest.fn(async () => NEW_ADDRESS),
                ...InvoicesStore
            },
            SettingsStore: { settings: {} },
            NodeInfoStore: { nodeInfo: { block_height: 900000 } }
        } as unknown as React.ComponentProps<typeof Receive>);
        // the view is never mounted, so apply state updates directly
        jest.spyOn(view, 'setState').mockImplementation((update: any) => {
            view.state = { ...view.state, ...update };
        });
        return view;
    };

    it.each([
        ['unified', 0],
        ['on-chain', 2]
    ])(
        'watches the address generated when switching to the %s tab',
        async (_tab, selectedIndex) => {
            const view = makeTabView({});
            view.subscribeInvoice('rhash');

            await view.updateIndex(selectedIndex);

            expect(BackendUtils.watchOnchainReceived).toHaveBeenCalledWith(
                expect.objectContaining({ address: NEW_ADDRESS }),
                expect.any(Function)
            );
            // the invoice stays watched
            expect(BackendUtils.watchInvoicePaid).toHaveBeenCalledTimes(1);
            expect(view.unsubscribeInvoiceWatch).toBeDefined();
        }
    );

    it('does not watch anything when the node returns no address', async () => {
        const view = makeTabView({ getNewAddress: jest.fn(async () => {}) });

        await view.updateIndex(2);

        expect(BackendUtils.watchOnchainReceived).not.toHaveBeenCalled();
    });

    it('does not generate an address when switching to the Lightning tab', async () => {
        const view = makeTabView({});

        await view.updateIndex(1);

        expect(view.props.InvoicesStore.getNewAddress).not.toHaveBeenCalled();
        expect(BackendUtils.watchOnchainReceived).not.toHaveBeenCalled();
    });

    it('does not watch the address when the screen unmounts before it resolves', async () => {
        let resolveAddress: (address: string) => void = () => {};
        const view = makeTabView({
            getNewAddress: jest.fn(
                () =>
                    new Promise<string>((resolve) => {
                        resolveAddress = resolve;
                    })
            ),
            reset: jest.fn()
        });
        Object.assign(view.props, { LSPStore: { reset: jest.fn() } });

        const pending = view.updateIndex(2);
        view.componentWillUnmount();
        resolveAddress(NEW_ADDRESS);
        await pending;

        expect(BackendUtils.watchOnchainReceived).not.toHaveBeenCalled();
        expect(view.unsubscribeOnchainWatch).toBeNull();
    });
});
