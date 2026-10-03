jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/Stores', () => ({
    unitsStore: { units: 'sats' },
    settingsStore: {
        settings: {
            fiat: 'USD',
            display: {
                showAllDecimalPlaces: false,
                removeDecimalSpaces: false
            }
        }
    },
    fiatStore: {
        fiatRates: [{ code: 'USD', rate: 50000 }],
        getSymbol: () => ({
            symbol: '$',
            space: false,
            rtl: false,
            separatorSwap: false,
            decimalPlaces: 2
        }),
        symbolLookup: () => ({ decimalPlaces: 2 })
    }
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../utils/LnurlPayUtils', () => ({
    verifyLnurlPayInvoice: jest.fn(),
    isLnurlCallbackAllowed: jest.fn()
}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('react-native-gesture-handler', () => ({ ScrollView: 'ScrollView' }));
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/AmountInput', () => 'AmountInput');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/TextInput', () => 'TextInput');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('./Metadata', () => 'LnurlPayMetadata');
jest.mock('../../models/Contact', () => class Contact {});

import * as React from 'react';
import LnurlPay from './LnurlPay';
import AmountInput from '../../components/AmountInput';
import { unitsStore } from '../../stores/Stores';

const FIXED_SATS = 12618;

const lnurlParams = (minSats: number, maxSats: number) => ({
    domain: 'example.com',
    callback: 'https://example.com/callback',
    minSendable: minSats * 1000,
    maxSendable: maxSats * 1000,
    metadata: JSON.stringify([['text/plain', 'test']]),
    commentAllowed: 0
});

const makeView = (params: { [key: string]: any }) =>
    new LnurlPay({
        navigation: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
            navigate: jest.fn()
        },
        route: { params },
        // resetUnits() is a no-op here, so the screen has to get the unit
        // right on its own
        UnitsStore: { resetUnits: jest.fn() },
        ContactStore: { contacts: [] },
        CashuStore: {},
        InvoicesStore: {},
        LnurlPayStore: {}
    } as unknown as React.ComponentProps<typeof LnurlPay>);

// AmountInput sits a few levels deep (Screen > ScrollView > View > View)
const findByType = (node: any, type: unknown): any => {
    if (!node || typeof node !== 'object') return undefined;
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findByType(child, type);
            if (found) return found;
        }
        return undefined;
    }
    if (!React.isValidElement(node)) return undefined;
    if (node.type === type) return node;
    return findByType((node.props as any).children, type);
};

const amountInputProps = (view: LnurlPay) => {
    const input = findByType(view.render(), AmountInput) as React.ReactElement<
        React.ComponentProps<typeof AmountInput>
    >;
    expect(input).toBeDefined();
    return input.props;
};

describe('LnurlPay fixed-amount prefill', () => {
    afterEach(() => {
        unitsStore.units = 'sats';
    });

    it('prefills a fixed request in sats while units are fiat', () => {
        unitsStore.units = 'fiat';
        const view = makeView({
            lnurlParams: lnurlParams(FIXED_SATS, FIXED_SATS)
        });

        expect(view.state.amount).toBe('12618');
        expect(view.state.satAmount).toBe(FIXED_SATS);
        expect(amountInputProps(view).forceUnit).toBe('sats');
    });

    it('prefills a fixed request in sats while units are BTC', () => {
        unitsStore.units = 'BTC';
        const view = makeView({
            lnurlParams: lnurlParams(FIXED_SATS, FIXED_SATS)
        });

        expect(view.state.amount).toBe('12618');
        expect(view.state.satAmount).toBe(FIXED_SATS);
        expect(amountInputProps(view).forceUnit).toBe('sats');
    });

    it('ignores a satAmount param on a fixed request', () => {
        unitsStore.units = 'fiat';
        // Send forwards its own amount as a string (Send.tsx:386)
        const view = makeView({
            lnurlParams: lnurlParams(FIXED_SATS, FIXED_SATS),
            satAmount: '5000'
        });

        expect(view.state.amount).toBe('12618');
        expect(view.state.satAmount).toBe(FIXED_SATS);
        expect(amountInputProps(view)).toMatchObject({
            amount: '12618',
            forceUnit: 'sats',
            locked: true
        });
    });

    it('keeps the fixed amount when the screen regains focus after a switch to fiat', () => {
        const view = makeView({
            lnurlParams: lnurlParams(FIXED_SATS, FIXED_SATS)
        });
        // setState on a class that was never mounted does nothing, so apply
        // it directly to see what the screen would render next
        jest.spyOn(view, 'setState').mockImplementation((update: any) => {
            view.state = { ...view.state, ...update };
        });
        view.componentDidMount();
        const [[event, onFocus]] = (
            view.props.navigation.addListener as jest.Mock
        ).mock.calls;
        expect(event).toBe('focus');

        unitsStore.units = 'fiat';
        onFocus();

        expect(view.state.amount).toBe('12618');
        expect(view.state.satAmount).toBe(FIXED_SATS);
        expect(amountInputProps(view).forceUnit).toBe('sats');
    });

    it('starts a variable request empty', () => {
        unitsStore.units = 'fiat';
        const view = makeView({ lnurlParams: lnurlParams(1, 100000) });

        expect(view.state.amount).toBe('');
        expect(view.state.satAmount).toBe('');
        expect(amountInputProps(view).forceUnit).toBeUndefined();
    });

    it('still prefills a variable request from a satAmount param in the current unit', () => {
        unitsStore.units = 'fiat';
        const view = makeView({
            lnurlParams: lnurlParams(1, 100000),
            satAmount: '5000'
        });

        expect(view.state.amount).toBe('2.50');
        expect(view.state.satAmount).toBe('5000');
        expect(amountInputProps(view).forceUnit).toBeUndefined();
    });
});
