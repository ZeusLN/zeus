const mockIsLsps2Active = jest.fn();

jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../utils/BackendUtils', () => {
    const mocked: any = {
        supportsFlowLSP: () => true,
        isLsps2Active: () => mockIsLsps2Active()
    };
    // render() asks for many supports*() flags; unlisted ones are off
    return new Proxy(mocked, {
        get: (target, key) =>
            key in target
                ? target[key]
                : key === '__esModule'
                ? false
                : () => false
    });
});
jest.mock('../../utils/KeypadUtils', () => ({
    ...jest.requireActual('../../utils/KeypadUtils'),
    resetKeypadTextAnimation: jest.fn()
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#000000' }));
jest.mock('../../utils/UnitsUtils', () => ({
    getDecimalPlaceholder: () => ({ count: 0 })
}));
jest.mock('../../components/AmountInput', () => ({
    getSatAmount: (amount: string) => Number(amount)
}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/EcashMintPicker', () => 'EcashMintPicker');
jest.mock('../../components/EcashToggle', () => 'EcashToggle');
jest.mock('../../components/KeypadAmountDisplay', () => 'KeypadAmountDisplay');
jest.mock('../../components/ModalBox', () => 'ModalBox');
jest.mock('../../components/PinPad', () => 'PinPad');
jest.mock('../../components/UnitToggle', () => 'UnitToggle');
jest.mock('../../components/CurrencySelectorModal', () => 'CurrencySelector');
jest.mock('../../components/WalletHeader', () => 'WalletHeader');
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../../components/layout/Spacer', () => ({ Spacer: 'Spacer' }));
jest.mock('../../stores/CashuStore', () => ({}));
jest.mock('../../stores/ChannelsStore', () => ({}));
jest.mock('../../stores/FiatStore', () => ({}));
jest.mock('../../stores/NodeInfoStore', () => ({}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/SyncStore', () => ({}));
jest.mock('../../stores/UnitsStore', () => ({}));
jest.mock('../../assets/images/SVG/Bitcoin.svg', () => 'Bitcoin');
jest.mock('../../assets/images/SVG/MintToken.svg', () => 'MintToken');

import * as React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import KeypadPane from './KeypadPane';

const collect = (node: any, out: any[] = []): any[] => {
    if (Array.isArray(node)) {
        node.forEach((n) => collect(n, out));
    } else if (node && typeof node === 'object' && node.props) {
        out.push(node);
        collect(node.props.children, out);
    }
    return out;
};

// 47,650 of inbound, of which 43,650 is left after the per-channel margin
const makeKeypad = () => {
    const view = new KeypadPane({
        navigation: { navigate: jest.fn(), addListener: jest.fn() },
        ChannelsStore: {
            channels: [{}],
            totalInbound: 47650,
            inboundForReceive: 43650
        },
        SettingsStore: { settings: { enableLSP: true } },
        CashuStore: { mintUrls: [] },
        SyncStore: { isSyncing: false },
        UnitsStore: { units: 'sats' }
    } as unknown as React.ComponentProps<typeof KeypadPane>);
    view.state = { ...view.state, flowLspNotConfigured: false };
    view.setState = jest.fn((update: any) => {
        view.state = { ...view.state, ...update };
    });
    return view;
};

// deleteValue runs the same inbound check as typing
const enter = (view: any, sats: string) => {
    view.amountInput = `${sats}1`;
    view.deleteValue();
};

const texts = (view: any) =>
    collect(view.render())
        .filter((e) => e.type === Text)
        .flatMap((e) => [].concat(e.props.children));

describe('KeypadPane inbound hint', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIsLsps2Active.mockReturnValue(true);
    });

    it('compares the amount with the inbound a JIT channel is bought against', () => {
        const view = makeKeypad();

        enter(view, '45000');
        expect(view.state.needInbound).toBe(true);

        enter(view, '40000');
        expect(view.state.needInbound).toBe(false);
    });

    it("skips Flow's 50,000 sat prompt under LSPS2", () => {
        const view = makeKeypad();

        enter(view, '45000');

        expect(view.state.needInbound).toBe(true);
        expect(view.state.belowMinAmount).toBe(false);
    });

    it("keeps Flow's 50,000 sat prompt under Flow", () => {
        mockIsLsps2Active.mockReturnValue(false);
        const view = makeKeypad();

        enter(view, '45000');

        expect(view.state.belowMinAmount).toBe(true);
    });

    it('explains the JIT channel without the Flow link', () => {
        const view = makeKeypad();
        enter(view, '45000');

        const shown = texts(view);
        expect(shown).toContain('views.Wallet.KeypadPane.lsps2Explainer');
        expect(shown).not.toContain('general.tapToLearnMore');
        expect(
            collect(view.render()).find((e) => e.type === TouchableOpacity)
                ?.props.disabled
        ).toBe(true);
    });

    it("keeps Flow's explainer and link under Flow", () => {
        mockIsLsps2Active.mockReturnValue(false);
        const view = makeKeypad();
        enter(view, '45000');

        const shown = texts(view);
        expect(shown).toContain('views.Wallet.KeypadPane.lspExplainer');
        expect(shown).toContain('general.tapToLearnMore');
    });
});
