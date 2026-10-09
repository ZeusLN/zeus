jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Chip: 'Chip', Icon: 'Icon' }));
jest.mock('@react-native-clipboard/clipboard', () => ({
    getString: jest.fn()
}));
jest.mock('react-native-nfc-manager', () => ({ isSupported: jest.fn() }));
jest.mock('../utils/handleAnything', () => ({
    __esModule: true,
    default: jest.fn(),
    isClipboardValue: jest.fn()
}));
jest.mock('../utils/BackendUtils', () => ({
    supportsOnchainSends: () => true,
    supportsOnchainSendMax: () => true,
    supportsOnchainSendFeeRate: () => false,
    supportsOnchainBatching: () => false,
    supportsCoinControl: () => false,
    supportsKeysend: () => false,
    supportsAMP: () => false,
    supportsOffersDirectPay: jest.fn(() => false),
    decodeOffer: jest.fn(),
    fetchInvoiceFromOffer: jest.fn()
}));
jest.mock('../utils/AddressUtils', () => ({
    extractBolt12Offer: (value: string) =>
        value.startsWith('lno1') ? value : undefined
}));
jest.mock('../utils/ErrorUtils', () => ({ errorToUserFriendly: jest.fn() }));
jest.mock('../utils/NFCUtils', () => ({ scanNfcTag: jest.fn() }));
jest.mock('../utils/AmountUtils', () => ({ getRawAmountFromSats: jest.fn() }));
jest.mock('../utils/GraphSyncUtils', () => ({
    clearPendingPaymentData: jest.fn()
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../components/AmountInput', () => 'AmountInput');
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/FeeLimit', () => 'FeeLimit');
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/SuccessErrorMessage', () => ({
    WarningMessage: 'WarningMessage',
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/OnchainFeeInput', () => 'OnchainFeeInput');
jest.mock('../components/Screen', () => 'Screen');
jest.mock('../components/Switch', () => 'Switch');
jest.mock('../components/SwipeButton', () => 'SwipeButton');
jest.mock('../components/TextInput', () => 'TextInput');
jest.mock('../components/UTXOPicker', () => 'UTXOPicker');
jest.mock('../assets/images/SVG/NFC-alt.svg', () => 'NFC');
jest.mock('../assets/images/SVG/PeersContact.svg', () => 'ContactIcon');
jest.mock('../assets/images/SVG/Scan.svg', () => 'Scan');
jest.mock('../models/Contact', () => class Contact {});
jest.mock('../stores/SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {},
    DEFAULT_SLIDE_TO_PAY_THRESHOLD: 10000
}));

import * as React from 'react';
import Send from './Send';
import BackendUtils from '../utils/BackendUtils';
import { errorToUserFriendly } from '../utils/ErrorUtils';

const BALANCE = 500000;

const childrenOf = (element: any): any[] =>
    React.Children.toArray(element?.props?.children);

// first element in the tree, depth first, that matches
const findElement = (node: any, match: (element: any) => boolean): any => {
    if (!React.isValidElement(node)) return undefined;
    if (match(node)) return node;
    for (const child of childrenOf(node)) {
        const found = findElement(child, match);
        if (found) return found;
    }
    return undefined;
};

const findByType = (tree: any, type: string, title?: string) =>
    findElement(
        tree,
        (element) =>
            element.type === type &&
            (title === undefined || element.props.title === title)
    );

// the Switch whose label is a sibling showing `text`
const findSwitchNextTo = (tree: any, text: string) => {
    const parent = findElement(tree, (element) =>
        childrenOf(element).some(
            (child: any) => child?.props?.children === text
        )
    );
    return childrenOf(parent).find((child: any) => child.type === 'Switch');
};

const makeView = (
    overrides: { TransactionsStore?: any; InvoicesStore?: any } = {}
) => {
    const view = new Send({
        navigation: { navigate: jest.fn() },
        route: {
            params: {
                destination: 'bcrt1qexample',
                transactionType: 'On-chain',
                isValid: true
            }
        },
        BalanceStore: {
            confirmedBlockchainBalance: BALANCE,
            totalBlockchainBalanceAccounts: BALANCE,
            lightningBalance: 0
        },
        ContactStore: { contacts: [] },
        InvoicesStore: overrides.InvoicesStore ?? {},
        ModalStore: {},
        NodeInfoStore: {},
        SettingsStore: { implementation: 'lnd', settings: {} },
        TransactionsStore: overrides.TransactionsStore ?? {},
        UTXOsStore: {}
    } as unknown as React.ComponentProps<typeof Send>);
    // setState on a class that was never mounted does nothing, so apply it
    // directly to see what the screen would render next
    jest.spyOn(view, 'setState').mockImplementation((update: any) => {
        view.state = { ...view.state, ...update };
    });
    return view;
};

const amountInputProps = (view: Send) =>
    findByType(view.render(), 'AmountInput').props;

const toggleSendMax = (view: Send) =>
    findSwitchNextTo(
        view.render(),
        'views.OpenChannel.fundMax'
    ).props.onValueChange();

// AmountInput reports the balance once when send max turns on (forceUnit
// changes to sats) and stays silent when it turns off
const turnSendMaxOn = (view: Send) => {
    toggleSendMax(view);
    amountInputProps(view).onAmountChange(String(BALANCE), BALANCE);
};

const isProceedDisabled = (view: Send) =>
    findByType(view.render(), 'Button', 'general.proceed').props.disabled;

describe('Send send max toggle', () => {
    it('restores the entered amount when send max is turned off', () => {
        const view = makeView();
        amountInputProps(view).onAmountChange('50000', 50000);

        turnSendMaxOn(view);
        toggleSendMax(view);

        expect(view.state.amount).toBe('50000');
        expect(view.state.satAmount).toBe(50000);
        expect(isProceedDisabled(view)).toBe(false);
    });

    it('keeps a cleared amount empty when send max is turned off again', () => {
        const view = makeView();
        amountInputProps(view).onAmountChange('50000', 50000);
        turnSendMaxOn(view);
        toggleSendMax(view);

        amountInputProps(view).onAmountChange('', 0);
        turnSendMaxOn(view);
        toggleSendMax(view);

        expect(view.state.amount).toBe('');
        expect(amountInputProps(view).amount).toBe('');
        expect(isProceedDisabled(view)).toBe(true);
    });
});

describe('Send BOLT 12 Proceed', () => {
    const offer = 'lno1qgsyxjtl6luzd9t3pr62xr7eemp6awnejusgf6gw45q75vcfqqqqqqq';
    const decodedOffer = { description: 'coffee', isExpired: false };

    const supportsOffersDirectPay =
        BackendUtils.supportsOffersDirectPay as jest.Mock;
    const decodeOffer = BackendUtils.decodeOffer as jest.Mock;
    const fetchInvoiceFromOffer =
        BackendUtils.fetchInvoiceFromOffer as jest.Mock;

    const makeOfferView = (paymentInFlight = false) => {
        const TransactionsStore = { paymentInFlight, sendPayment: jest.fn() };
        const InvoicesStore = { getPayReq: jest.fn() };
        const view = makeView({ TransactionsStore, InvoicesStore });
        view.state = {
            ...view.state,
            bolt12: offer,
            satAmount: 2500,
            feeLimitSat: '25',
            timeoutSeconds: '45'
        } as any;
        return { view, TransactionsStore, InvoicesStore };
    };

    beforeEach(() => {
        supportsOffersDirectPay.mockReset();
        decodeOffer.mockReset();
        fetchInvoiceFromOffer.mockReset();
    });

    it('only decodes the offer and opens the review screen on a direct-pay backend', async () => {
        supportsOffersDirectPay.mockReturnValue(true);
        decodeOffer.mockResolvedValue(decodedOffer);
        const { view, TransactionsStore } = makeOfferView();

        await view.payBolt12();

        expect(decodeOffer).toHaveBeenCalledWith({ offer });
        expect(fetchInvoiceFromOffer).not.toHaveBeenCalled();
        expect(TransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(view.props.navigation.navigate).toHaveBeenCalledTimes(1);
        expect(view.props.navigation.navigate).toHaveBeenCalledWith(
            'Bolt12OfferReview',
            {
                offer,
                decodedOffer,
                satAmount: '2500',
                timeoutSeconds: '45',
                feeLimitSat: '25'
            }
        );
        expect(view.state.loading).toBe(false);
    });

    it('shows the decode error and stays on Send when the offer cannot be decoded', async () => {
        supportsOffersDirectPay.mockReturnValue(true);
        const error = new Error('bad offer');
        decodeOffer.mockRejectedValue(error);
        (errorToUserFriendly as jest.Mock).mockReturnValue('bad offer');
        const { view, TransactionsStore } = makeOfferView();

        await view.payBolt12();

        expect(TransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(view.props.navigation.navigate).not.toHaveBeenCalled();
        expect(view.state.loading).toBe(false);
        expect(errorToUserFriendly).toHaveBeenCalledWith(error);
        expect(view.state.error_msg).toBe('bad offer');
    });

    it('does nothing while another payment is in flight', async () => {
        supportsOffersDirectPay.mockReturnValue(true);
        const { view } = makeOfferView(true);

        await view.payBolt12();

        expect(decodeOffer).not.toHaveBeenCalled();
        expect(view.props.navigation.navigate).not.toHaveBeenCalled();
    });

    it('fetches an invoice for PaymentRequest on a backend without direct offer pay', async () => {
        supportsOffersDirectPay.mockReturnValue(false);
        fetchInvoiceFromOffer.mockResolvedValue({ invoice: 'lnbcrt1...' });
        const { view, TransactionsStore, InvoicesStore } = makeOfferView();

        await view.payBolt12();

        expect(decodeOffer).not.toHaveBeenCalled();
        expect(fetchInvoiceFromOffer).toHaveBeenCalledWith(
            offer,
            2500,
            '45',
            '25'
        );
        expect(InvoicesStore.getPayReq).toHaveBeenCalledWith('lnbcrt1...');
        expect(view.props.navigation.navigate).toHaveBeenCalledWith(
            'PaymentRequest'
        );
        expect(TransactionsStore.sendPayment).not.toHaveBeenCalled();
    });
});
