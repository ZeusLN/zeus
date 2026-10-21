jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({
    ButtonGroup: 'ButtonGroup',
    Icon: 'Icon'
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
    getString: jest.fn()
}));
jest.mock('react-native-nfc-manager', () => ({ isSupported: jest.fn() }));
jest.mock('../../utils/handleAnything', () => ({
    __esModule: true,
    default: jest.fn()
}));
jest.mock('../../utils/BackendUtils', () => ({}));
jest.mock('../../utils/NFCUtils', () => ({
    isNfcWithdraw: jest.requireActual('../../utils/NFCUtils').isNfcWithdraw,
    scanNfcTag: jest.fn()
}));
jest.mock('../../utils/AmountUtils', () => ({ getAmountFromSats: jest.fn() }));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../components/AmountInput', () => ({
    __esModule: true,
    default: 'AmountInput',
    getSatAmount: (amount: string) => Number(amount || 0)
}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/CollapsedQR', () => 'CollapsedQR');
jest.mock('../../components/EcashMintPicker', () => 'EcashMintPicker');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/HopPicker', () => 'HopPicker');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/PaidIndicator', () => 'PaidIndicator');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/SuccessAnimation', () => 'SuccessAnimation');
jest.mock('../../components/SuccessErrorMessage', () => ({
    SuccessMessage: 'SuccessMessage',
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/TextInput', () => 'TextInput');
jest.mock('../../components/SVG/AddressSvg', () => 'AddressSvg');
jest.mock('../../components/SVG/LightningSvg', () => 'LightningSvg');
jest.mock('../../assets/images/SVG/NFC-alt.svg', () => 'NfcIcon');
jest.mock('../../assets/images/SVG/Scan.svg', () => 'ScanSvg');
jest.mock('../../assets/images/SVG/wordmark-black.svg', () => 'Wordmark');

import * as React from 'react';
import ReceiveEcash from './ReceiveEcash';
import handleAnything from '../../utils/handleAnything';
import { scanNfcTag } from '../../utils/NFCUtils';

const withdrawParams = {
    tag: 'withdrawRequest',
    callback: 'https://card.example/withdraw',
    k1: 'k1',
    defaultDescription: 'Bolt Card'
};

// what Pay via NFC does once the tag resolves to `response`
const scanTag = async (
    response: any,
    amount: string,
    createFails = false,
    readFails = false
) => {
    const navigate = jest.fn();
    const createInvoice = jest.fn(() =>
        createFails ? Promise.reject(new Error('offline')) : Promise.resolve()
    );
    const view = new ReceiveEcash({
        navigation: { navigate },
        route: { params: { amount } },
        CashuStore: { createInvoice },
        LightningAddressStore: {},
        ModalStore: {},
        NodeInfoStore: {},
        SettingsStore: { posStatus: 'active', settings: {} }
    } as unknown as React.ComponentProps<typeof ReceiveEcash>);
    view.subscribeInvoice = jest.fn();
    view.setState = jest.fn();
    (scanNfcTag as jest.Mock).mockResolvedValue('tag text');
    if (readFails) {
        (handleAnything as jest.Mock).mockRejectedValue(
            new Error('unsupported')
        );
    } else {
        (handleAnything as jest.Mock).mockResolvedValue(response);
    }

    await view.scanNfc();
    await new Promise((resolve) => setImmediate(resolve));
    return { navigate, createInvoice, setState: view.setState as jest.Mock };
};

describe('ReceiveEcash.validateAddress (Pay via NFC)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('creates an invoice for an LNURL-withdraw card when an amount is set', async () => {
        const { navigate, createInvoice } = await scanTag(
            ['ChoosePaymentMethod', { lnurlParams: withdrawParams }],
            '1000'
        );

        expect(createInvoice).toHaveBeenCalledWith(
            expect.objectContaining({ value: '1000', lnurl: withdrawParams })
        );
        expect(navigate).not.toHaveBeenCalled();
    });

    it('opens the receive method choice for an LNURL-withdraw card on a zero amount', async () => {
        const props = { lnurlParams: withdrawParams };
        const { navigate } = await scanTag(['ChoosePaymentMethod', props], '0');

        expect(navigate).toHaveBeenCalledWith('ChoosePaymentMethod', props);
    });

    it('clears the NFC error on a new read and keeps it off for a withdraw card', async () => {
        const { setState } = await scanTag(
            ['ChoosePaymentMethod', { lnurlParams: withdrawParams }],
            '0'
        );

        expect(setState).toHaveBeenCalledWith({ nfcError: false });
        expect(setState).not.toHaveBeenCalledWith({ nfcError: true });
    });

    it('shows the NFC error when the tag cannot be read as a payment code', async () => {
        const { navigate, setState } = await scanTag(
            undefined,
            '0',
            false,
            true
        );

        expect(navigate).not.toHaveBeenCalled();
        expect(setState).toHaveBeenLastCalledWith({ nfcError: true });
    });

    it.each([
        ['LnurlPay', { tag: 'payRequest', defaultDescription: 'x' }],
        // Lightning address: the server picks the tag
        ['LnurlPay', { tag: 'withdrawRequest', defaultDescription: 'x' }],
        ['LnurlChannel', { tag: 'channelRequest', defaultDescription: 'x' }],
        ['LnurlAuth', { tag: 'login', defaultDescription: 'x' }]
    ])('opens no screen for a %s result (%j)', async (route, lnurlParams) => {
        const zero = await scanTag([route, { lnurlParams }], '0');
        expect(zero.navigate).not.toHaveBeenCalled();
        expect(zero.setState).toHaveBeenLastCalledWith({ nfcError: true });

        const failed = await scanTag([route, { lnurlParams }], '1000', true);
        expect(failed.createInvoice).not.toHaveBeenCalled();
        expect(failed.navigate).not.toHaveBeenCalled();
    });
});
