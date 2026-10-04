jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Divider: 'Divider' }));
jest.mock('@react-native-clipboard/clipboard', () => ({
    getString: jest.fn(),
    setString: jest.fn()
}));
jest.mock('react-native-nfc-manager', () => ({ isSupported: jest.fn() }));
jest.mock('../stores/ChannelsStore', () => ({
    ChannelsType: { Open: 0, Pending: 1, Closed: 2 },
    ChannelsView: { Channels: 'channels', Peers: 'peers' }
}));
jest.mock('../stores/SettingsStore', () => ({
    getLspConfigForNetwork: jest.fn(() => ({}))
}));
jest.mock('../utils/BackendUtils', () => ({
    supportsChannelOpenFeeRate: () => false,
    supportsChannelFundMax: () => true,
    supportsChannelBatching: () => false,
    supportsChannelCoinControl: () => false,
    supportsPendingChannels: () => false,
    supportsSimpleTaprootChannels: () => false,
    isLNDBased: jest.fn(() => true)
}));
jest.mock('../utils/handleAnything', () => jest.fn());
jest.mock('../utils/NFCUtils', () => ({ scanNfcTag: jest.fn() }));
jest.mock('../utils/NodeUriUtils', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../components/Amount', () => 'Amount');
jest.mock('../components/AmountInput', () => 'AmountInput');
jest.mock('../components/Text', () => 'Text');
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../components/Accordion', () => 'Accordion');
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/OnchainFeeInput', () => 'OnchainFeeInput');
jest.mock('../components/KeyValue', () => 'KeyValue');
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/Screen', () => 'Screen');
jest.mock('../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../components/Switch', () => 'Switch');
jest.mock('../components/TextInput', () => 'TextInput');
jest.mock('../components/UTXOPicker', () => 'UTXOPicker');
jest.mock('../components/ToggleButton', () => 'ToggleButton');
jest.mock('../assets/images/SVG/Scan.svg', () => 'Scan');
jest.mock('../assets/images/SVG/NFC-alt.svg', () => 'NfcIcon');

import * as React from 'react';
import OpenChannel from './OpenChannel';
import BackendUtils from '../utils/BackendUtils';

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

const makeView = ({
    implementation = 'lnd',
    confirmedBlockchainBalance = BALANCE,
    unconfirmedBlockchainBalance = 0
} = {}) => {
    (BackendUtils.isLNDBased as jest.Mock).mockReturnValue(
        implementation === 'lnd'
    );
    const view = new OpenChannel({
        navigation: { navigate: jest.fn() },
        route: { params: {} },
        BalanceStore: {
            confirmedBlockchainBalance,
            unconfirmedBlockchainBalance
        },
        ChannelsStore: {
            channelsView: 'channels',
            aliasesByPubkey: {},
            nodes: {}
        },
        ModalStore: {},
        NodeInfoStore: { nodeInfo: {} },
        SettingsStore: { implementation, settings: {} },
        UTXOsStore: {}
    } as unknown as React.ComponentProps<typeof OpenChannel>);
    // setState on a class that was never mounted does nothing, so apply it
    // directly to see what the screen would render next
    jest.spyOn(view, 'setState').mockImplementation((update: any) => {
        view.state = { ...view.state, ...update };
    });
    return view;
};

const amountInputProps = (view: OpenChannel) =>
    findByType(view.render(), 'AmountInput').props;

const toggleFundMax = (view: OpenChannel) =>
    findSwitchNextTo(
        view.render(),
        'views.OpenChannel.fundMax'
    ).props.onValueChange();

// AmountInput reports the balance once when fund max turns on (forceUnit
// changes to sats) and stays silent when it turns off
const turnFundMaxOn = (view: OpenChannel) => {
    toggleFundMax(view);
    amountInputProps(view).onAmountChange(String(BALANCE), BALANCE);
};

const isOpenDisabled = (view: OpenChannel) =>
    findByType(view.render(), 'Button', 'views.OpenChannel.openChannel').props
        .disabled;

describe('OpenChannel fund max toggle', () => {
    it('restores the entered amount when fund max is turned off', () => {
        const view = makeView();
        amountInputProps(view).onAmountChange('50000', 50000);

        turnFundMaxOn(view);
        expect(amountInputProps(view).amount).toBe(String(BALANCE));

        toggleFundMax(view);
        expect(view.state.local_funding_amount).toBe('50000');
        expect(view.state.satAmount).toBe(50000);
        expect(amountInputProps(view).amount).toBe('50000');
        expect(isOpenDisabled(view)).toBe(false);
    });

    it('keeps an empty amount empty when fund max is turned off', () => {
        const view = makeView();
        // AmountInput reports '0' for the empty field on mount
        amountInputProps(view).onAmountChange('', '0');

        turnFundMaxOn(view);
        expect(isOpenDisabled(view)).toBe(false);

        toggleFundMax(view);
        expect(view.state.local_funding_amount).toBe('');
        expect(amountInputProps(view).amount).toBe('');
        expect(isOpenDisabled(view)).toBe(true);
    });
});

describe('OpenChannel fund max with unconfirmed funds and min confs 0', () => {
    const UNCONFIRMED = 100000;

    const setMinConfsZero = (view: OpenChannel) =>
        findElement(
            view.render(),
            (element) =>
                element.type === 'TextInput' &&
                element.props.placeholder === '1'
        ).props.onChangeText('0');

    it.each([
        ['lnd', String(UNCONFIRMED), false],
        ['cln-rest', String(UNCONFIRMED), false],
        // LDK Node does not pass min confs to the node
        ['ldk-node', '0', true]
    ])(
        'on %s shows %s and sets the open button disabled to %s',
        (implementation, shownAmount, disabled) => {
            const view = makeView({
                implementation,
                confirmedBlockchainBalance: 0,
                unconfirmedBlockchainBalance: UNCONFIRMED
            });
            setMinConfsZero(view);
            toggleFundMax(view);

            expect(amountInputProps(view).amount).toBe(shownAmount);
            expect(isOpenDisabled(view)).toBe(disabled);
        }
    );
});
