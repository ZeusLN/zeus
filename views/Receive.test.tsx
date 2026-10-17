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

describe('Receive.validateAddress (Pay via NFC)', () => {
    const withdrawParams = {
        tag: 'withdrawRequest',
        callback: 'https://card.example/withdraw',
        k1: 'k1',
        defaultDescription: 'Bolt Card'
    };

    const makeNfcView = (amount: string) => {
        const navigation = { navigate: jest.fn() };
        const createUnifiedInvoice = jest.fn(() =>
            Promise.resolve({ rHash: 'rhash' })
        );
        const view = new Receive({
            navigation,
            route: { params: { amount } },
            SettingsStore: { settings: {} },
            InvoicesStore: { createUnifiedInvoice },
            NodeInfoStore: { nodeInfo: { block_height: 900000 } }
        } as unknown as React.ComponentProps<typeof Receive>);
        view.subscribeInvoice = jest.fn();
        return { view, navigation, createUnifiedInvoice };
    };

    const flush = () => new Promise((resolve) => setImmediate(resolve));

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it.each([
        [
            'an LNURL-pay request',
            'LnurlPay',
            {
                tag: 'payRequest',
                callback: 'https://x.example/cb',
                defaultDescription: 'x'
            }
        ],
        [
            'a Lightning address whose server answers withdrawRequest',
            'LnurlPay',
            {
                tag: 'withdrawRequest',
                callback: 'https://x.example/cb',
                defaultDescription: 'x'
            }
        ],
        [
            'an LNURL-channel request',
            'LnurlChannel',
            { tag: 'channelRequest', defaultDescription: 'x' }
        ],
        [
            'an LNURL-auth request',
            'LnurlAuth',
            { tag: 'login', defaultDescription: 'x' }
        ]
    ])(
        'opens no screen for %s on a zero amount',
        async (_, route, lnurlParams) => {
            (getSatAmount as jest.Mock).mockReturnValue(0);
            (handleAnything as unknown as jest.Mock).mockResolvedValue([
                route,
                { lnurlParams }
            ]);
            const { view, navigation, createUnifiedInvoice } = makeNfcView('0');

            view.validateAddress('https://x.example/lnurlp/tag');
            await flush();

            expect(navigation.navigate).not.toHaveBeenCalled();
            expect(createUnifiedInvoice).not.toHaveBeenCalled();
        }
    );

    it('opens no screen for an LNURL-pay request when invoice creation fails', async () => {
        (getSatAmount as jest.Mock).mockReturnValue(5000);
        (handleAnything as unknown as jest.Mock).mockResolvedValue([
            'LnurlPay',
            {
                lnurlParams: {
                    tag: 'payRequest',
                    callback: 'https://x.example/cb',
                    defaultDescription: 'x'
                }
            }
        ]);
        const { view, navigation, createUnifiedInvoice } = makeNfcView('5000');
        createUnifiedInvoice.mockImplementation(() =>
            Promise.reject(new Error('offline'))
        );

        view.validateAddress('https://x.example/lnurlp/tag');
        await flush();

        expect(createUnifiedInvoice).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('opens the withdraw form for an LNURL-withdraw card on a zero amount', async () => {
        (getSatAmount as jest.Mock).mockReturnValue(0);
        const props = { lnurlParams: withdrawParams };
        (handleAnything as unknown as jest.Mock).mockResolvedValue([
            'Receive',
            props
        ]);
        const { view, navigation } = makeNfcView('0');

        view.validateAddress('lnurlw://card.example/w');
        await flush();

        expect(navigation.navigate).toHaveBeenCalledWith('Receive', props);
    });

    it('creates an invoice for the card to pay when an amount is set', async () => {
        (getSatAmount as jest.Mock).mockReturnValue(5000);
        (handleAnything as unknown as jest.Mock).mockResolvedValue([
            'Receive',
            { lnurlParams: withdrawParams }
        ]);
        const { view, navigation, createUnifiedInvoice } = makeNfcView('5000');

        view.validateAddress('lnurlw://card.example/w');
        await flush();

        expect(createUnifiedInvoice).toHaveBeenCalledWith(
            expect.objectContaining({
                value: '5000',
                lnurl: withdrawParams
            })
        );
        expect(view.subscribeInvoice).toHaveBeenCalledWith('rhash', undefined);
        expect(navigation.navigate).not.toHaveBeenCalled();
    });
});
