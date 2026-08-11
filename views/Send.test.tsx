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
    supportsAMP: () => false
}));
jest.mock('../utils/AddressUtils', () => ({}));
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

const makeView = () => {
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
        InvoicesStore: {},
        ModalStore: {},
        NodeInfoStore: {},
        SettingsStore: { implementation: 'lnd', settings: {} },
        TransactionsStore: {},
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
