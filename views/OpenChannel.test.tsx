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
    getLspConfigForNetwork: jest.fn(() => ({})),
    isOlympusPeer: jest.fn(() => true)
}));
jest.mock('../utils/BackendUtils', () => ({
    supportsChannelOpenFeeRate: () => false,
    supportsChannelOpenMinConfs: jest.fn(() => true),
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
jest.mock('../utils/LocaleUtils');
// the theme key comes through, so a field's error color is visible
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => key
}));
jest.mock('../components/Amount', () => 'Amount');
jest.mock('../components/AmountInput', () => 'AmountInput');
jest.mock('../components/Text', () => {
    const { Text } = require('react-native');
    return ({ children }: any) => <Text>{children}</Text>;
});
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../components/Accordion', () => 'Accordion');
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/OnchainFeeInput', () => 'OnchainFeeInput');
jest.mock('../components/KeyValue', () => 'KeyValue');
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage',
    WarningMessage: 'WarningMessage'
}));
jest.mock('../components/Switch', () => 'Switch');
jest.mock('../components/TextInput', () => 'TextInput');
jest.mock('../components/UTXOPicker', () => 'UTXOPicker');
jest.mock('../components/ToggleButton', () => 'ToggleButton');
jest.mock('../assets/images/SVG/Scan.svg', () => 'Scan');
jest.mock('../assets/images/SVG/NFC-alt.svg', () => 'NfcIcon');

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import OpenChannel from './OpenChannel';
import BackendUtils from '../utils/BackendUtils';
import { getLspConfigForNetwork, isOlympusPeer } from '../stores/SettingsStore';

const BALANCE = 500000;
const OPEN = 'views.OpenChannel.openChannel';

// a valid peer, so Open is not disabled for want of one
const PEER = {
    node_pubkey_string: `02${'d'.repeat(64)}`,
    host: 'peer.example.com:9735'
};

const makeProps = ({
    implementation = 'lnd',
    confirmedBlockchainBalance = BALANCE,
    unconfirmedBlockchainBalance = 0,
    routeParams = PEER,
    settings = {},
    openOutcomeUnknown = false,
    openingChannel = false,
    syncOpensInFlight = 0,
    channelsView = 'channels'
}: {
    implementation?: string;
    confirmedBlockchainBalance?: number;
    unconfirmedBlockchainBalance?: number;
    routeParams?: { node_pubkey_string?: string; host?: string };
    settings?: any;
    openOutcomeUnknown?: boolean;
    openingChannel?: boolean;
    syncOpensInFlight?: number;
    channelsView?: string;
} = {}) => {
    (BackendUtils.isLNDBased as jest.Mock).mockReturnValue(
        implementation === 'lnd'
    );
    (BackendUtils.supportsChannelOpenMinConfs as jest.Mock).mockReturnValue(
        implementation !== 'ldk-node'
    );
    return {
        navigation: { navigate: jest.fn() },
        route: { params: routeParams },
        BalanceStore: {
            confirmedBlockchainBalance,
            unconfirmedBlockchainBalance
        },
        ChannelsStore: {
            channelsView,
            aliasesByPubkey: {},
            nodes: {},
            openOutcomeUnknown,
            openingChannel,
            syncOpensInFlight,
            resetOpenChannel: jest.fn(),
            connectPeer: jest.fn(() => Promise.resolve())
        },
        ModalStore: {},
        NodeInfoStore: { nodeInfo: {} },
        SettingsStore: { implementation, settings },
        UTXOsStore: {}
    } as any;
};

const renderView = async (options: Parameters<typeof makeProps>[0] = {}) => {
    const props = makeProps(options);
    const result = await render(<OpenChannel {...props} />);
    return { props, ...result };
};

const hosts = (type: string) =>
    screen.container.queryAll((n) => n.type === type);

const amountInput = () => hosts('AmountInput')[0];
const enterAmount = (amount: string, sats: number | string) =>
    fireEvent(amountInput(), 'amountChange', amount, sats);

const openButton = () => hosts('Button').find((n) => n.props.title === OPEN)!;
const isOpenDisabled = () => openButton().props.disabled;

// the Switch in the row labelled `text`
const switchNextTo = (text: string) => {
    let node: TestInstance | null = screen.getByText(text);
    while (node && !node.queryAll((n) => n.type === 'Switch').length) {
        node = node.parent;
    }
    return node!.queryAll((n) => n.type === 'Switch')[0];
};

const toggleFundMax = () =>
    fireEvent(switchNextTo('views.OpenChannel.fundMax'), 'valueChange');

// AmountInput reports the balance once when fund max turns on (forceUnit
// changes to sats) and stays silent when it turns off
const turnFundMaxOn = async () => {
    await toggleFundMax();
    await enterAmount(String(BALANCE), BALANCE);
};

const textInputWith = (placeholder: string) =>
    hosts('TextInput').find((n) => n.props.placeholder === placeholder);
const minConfsInput = () => textInputWith('1');

// the request handed to ChannelsStore.connectPeer when Open is pressed.
// fireEvent.press ignores disabled on the mocked Button, so check it here
const openRequest = async (props: any) => {
    expect(isOpenDisabled()).toBe(false);
    await fireEvent.press(openButton());
    return props.ChannelsStore.connectPeer.mock.calls[0][0];
};

describe('OpenChannel after an open with an unknown outcome', () => {
    it('allows opening with a valid amount', async () => {
        await renderView();
        await enterAmount('50000', 50000);

        expect(isOpenDisabled()).toBe(false);
    });

    it('does not allow opening again', async () => {
        await renderView({ openOutcomeUnknown: true });
        await enterAmount('50000', 50000);

        expect(isOpenDisabled()).toBe(true);
    });
});

describe('OpenChannel while an earlier open is in flight', () => {
    const warnings = () => hosts('WarningMessage');

    it('does not allow opening and says why', async () => {
        await renderView({ syncOpensInFlight: 1 });
        await enterAmount('50000', 50000);

        expect(isOpenDisabled()).toBe(true);
        expect(warnings()).toHaveLength(1);
        expect(warnings()[0].props.message).toBe(
            'views.OpenChannel.earlierOpenInFlight'
        );
    });

    it("shows no warning for this screen's own open", async () => {
        await renderView({ syncOpensInFlight: 1, openingChannel: true });

        expect(warnings()).toHaveLength(0);
        expect(hosts('LoadingIndicator')).toHaveLength(1);
    });

    it('still allows connecting to a peer', async () => {
        await renderView({ syncOpensInFlight: 1, channelsView: 'peers' });

        const connect = hosts('Button').find(
            (n) => n.props.title === 'views.OpenChannel.connectPeer'
        )!;
        expect(connect.props.disabled).toBe(false);
        expect(warnings()).toHaveLength(0);
    });
});

describe('OpenChannel fund max toggle', () => {
    it('restores the entered amount when fund max is turned off', async () => {
        const { props } = await renderView();
        await enterAmount('50000', 50000);

        await turnFundMaxOn();
        expect(amountInput().props.amount).toBe(String(BALANCE));

        await toggleFundMax();
        expect(amountInput().props.amount).toBe('50000');
        expect(isOpenDisabled()).toBe(false);
        expect(await openRequest(props)).toMatchObject({
            local_funding_amount: '50000',
            fundMax: false
        });
    });

    it('keeps an empty amount empty when fund max is turned off', async () => {
        await renderView();
        // AmountInput reports '0' for the empty field on mount
        await enterAmount('', '0');

        await turnFundMaxOn();
        expect(isOpenDisabled()).toBe(false);

        await toggleFundMax();
        expect(amountInput().props.amount).toBe('');
        expect(isOpenDisabled()).toBe(true);
    });
});

describe('OpenChannel fund max with unconfirmed funds and min confs 0', () => {
    const UNCONFIRMED = 100000;

    it.each(['lnd', 'cln-rest'])(
        'on %s counts unconfirmed funds',
        async (implementation) => {
            await renderView({
                implementation,
                confirmedBlockchainBalance: 0,
                unconfirmedBlockchainBalance: UNCONFIRMED
            });
            await fireEvent.changeText(minConfsInput()!, '0');
            await toggleFundMax();

            expect(amountInput().props.amount).toBe(String(UNCONFIRMED));
            expect(isOpenDisabled()).toBe(false);
        }
    );

    it('on ldk-node hides the min confs field', async () => {
        await renderView({ implementation: 'ldk-node' });

        expect(minConfsInput()).toBeUndefined();
    });

    it('on ldk-node ignores a min confs of 0 from settings', async () => {
        await renderView({
            implementation: 'ldk-node',
            confirmedBlockchainBalance: 0,
            unconfirmedBlockchainBalance: UNCONFIRMED,
            settings: { channels: { min_confs: 0 } }
        });
        await toggleFundMax();

        expect(amountInput().props.amount).toBe('0');
        expect(isOpenDisabled()).toBe(true);
    });
});

describe('OpenChannel LSP channel partner', () => {
    const OLYMPUS = {
        lsps1Pubkey: `03${'a'.repeat(64)}`,
        lsps1Host: '45.79.192.236:9735'
    };
    const OTHER = {
        lsps1Pubkey: `02${'b'.repeat(64)}`,
        lsps1Host: 'lsp.example.com:9735'
    };

    const getLspConfig = getLspConfigForNetwork as jest.Mock;
    const isOlympus = isOlympusPeer as jest.Mock;

    beforeEach(() => {
        getLspConfig.mockReturnValue(OLYMPUS);
    });

    afterEach(() => {
        getLspConfig.mockReturnValue({});
        isOlympus.mockReturnValue(true);
        jest.restoreAllMocks();
    });

    const partnerDropdown = () =>
        hosts('DropdownSetting').find(
            (n) => n.props.title === 'general.channelPartner'
        )!;
    const choosePartner = (value: string) =>
        fireEvent(partnerDropdown(), 'valueChange', value);

    const pubkeyInput = () => textInputWith('0A...')!;
    const hostInput = () => textInputWith('views.OpenChannel.hostPort')!;

    // what the peer fields show; an invalid value turns its field red
    const peerShown = () => ({
        node_pubkey_string: pubkeyInput().props.value,
        host: hostInput().props.value,
        isNodePubkeyValid: pubkeyInput().props.textColor === 'text',
        isNodeHostValid: hostInput().props.textColor === 'text'
    });

    // A new props object re-renders the screen, as a settings change does
    const rerenderWith = (props: any, rerender: any) =>
        rerender(
            <OpenChannel
                {...props}
                SettingsStore={{ ...props.SettingsStore }}
            />
        );

    it.each([
        [true, 'Olympus by ZEUS'],
        [false, 'general.lsp']
    ])(
        'labels the LSP option by isOlympusPeer (%s → %s) and keeps its value',
        async (olympus, label) => {
            isOlympus.mockReturnValue(olympus);
            await renderView({ routeParams: {} });
            const [lspOption] = partnerDropdown().props.values;

            expect(lspOption.key).toBe(label);
            expect(lspOption.value).toBe('LSP');
        }
    );

    it('moves the cached peer to a changed LSPS1 config while LSP is selected', async () => {
        const { props, rerender } = await renderView({ routeParams: {} });
        expect(partnerDropdown().props.selectedValue).toBe('LSP');

        getLspConfig.mockReturnValue({ ...OTHER, lsps1Host: '' });
        await rerenderWith(props, rerender);

        expect(peerShown()).toEqual({
            node_pubkey_string: OTHER.lsps1Pubkey,
            host: '',
            isNodePubkeyValid: true,
            isNodeHostValid: false
        });

        getLspConfig.mockReturnValue(OTHER);
        await rerenderWith(props, rerender);

        expect(peerShown()).toEqual({
            node_pubkey_string: OTHER.lsps1Pubkey,
            host: OTHER.lsps1Host,
            isNodePubkeyValid: true,
            isNodeHostValid: true
        });
    });

    it('does not set state when the cached peer already matches the config', async () => {
        const { props, rerender } = await renderView({ routeParams: {} });
        const setState = jest.spyOn(OpenChannel.prototype, 'setState');

        await rerenderWith(props, rerender);

        expect(setState).not.toHaveBeenCalled();
    });

    it('leaves a typed pubkey alone while Custom is selected', async () => {
        const { props, rerender } = await renderView({ routeParams: {} });
        await choosePartner('Custom');
        await fireEvent.changeText(pubkeyInput(), OTHER.lsps1Pubkey);

        getLspConfig.mockReturnValue({
            lsps1Pubkey: `03${'c'.repeat(64)}`,
            lsps1Host: '10.0.0.1:9735'
        });
        await rerenderWith(props, rerender);

        expect(partnerDropdown().props.selectedValue).toBe('Custom');
        expect(pubkeyInput().props.value).toBe(OTHER.lsps1Pubkey);
    });

    it('locks the peer fields under LSP and restores the configured peer', async () => {
        await renderView({ routeParams: {} });
        expect(pubkeyInput().props.locked).toBe(true);
        expect(hostInput().props.locked).toBe(true);

        await choosePartner('Custom');
        expect(pubkeyInput().props.locked).toBe(false);
        expect(hostInput().props.locked).toBe(false);

        await fireEvent.changeText(pubkeyInput(), OTHER.lsps1Pubkey);
        await fireEvent.changeText(hostInput(), OTHER.lsps1Host);

        await choosePartner('LSP');
        expect(pubkeyInput().props.locked).toBe(true);
        expect(hostInput().props.locked).toBe(true);
        expect(peerShown()).toEqual({
            node_pubkey_string: OLYMPUS.lsps1Pubkey,
            host: OLYMPUS.lsps1Host,
            isNodePubkeyValid: true,
            isNodeHostValid: true
        });
    });

    it('selects Custom for a routed peer and does not sync over it', async () => {
        const { props, rerender } = await renderView({
            routeParams: {
                node_pubkey_string: OTHER.lsps1Pubkey,
                host: OTHER.lsps1Host
            }
        });
        expect(partnerDropdown().props.selectedValue).toBe('Custom');

        await rerenderWith(props, rerender);

        expect(pubkeyInput().props.value).toBe(OTHER.lsps1Pubkey);
        expect(hostInput().props.value).toBe(OTHER.lsps1Host);
    });

    it('opens the channel to the LSP peer', async () => {
        const { props } = await renderView({ routeParams: {} });
        await enterAmount('50000', 50000);

        expect(await openRequest(props)).toMatchObject({
            node_pubkey_string: OLYMPUS.lsps1Pubkey,
            host: OLYMPUS.lsps1Host
        });
    });
});

describe('OpenChannel min confs default from settings', () => {
    it.each([
        [0, '0', true],
        [3, '3', false],
        [undefined, '1', false]
    ])(
        'a saved min confs of %s loads as %s with spend unconfirmed %s',
        async (saved, shown, spendUnconfirmed) => {
            const { props } = await renderView({
                settings: { channels: { min_confs: saved } }
            });
            await enterAmount('50000', 50000);

            expect(minConfsInput()!.props.value).toBe(shown);
            expect(await openRequest(props)).toMatchObject({
                min_confs: Number(shown),
                spend_unconfirmed: spendUnconfirmed
            });
        }
    );

    it.each([
        [
            'uses the default for each toggle missing from saved settings',
            { min_confs: 3 },
            {
                privateChannel: true,
                scidAlias: true,
                simpleTaprootChannel: false
            }
        ],
        [
            'loads each saved toggle that differs from the default',
            {
                min_confs: 3,
                privateChannel: false,
                scidAlias: false,
                simpleTaprootChannel: true
            },
            {
                privateChannel: false,
                scidAlias: false,
                simpleTaprootChannel: true
            }
        ]
    ])('%s', async (_name, channels, toggles) => {
        const { props } = await renderView({ settings: { channels } });
        await enterAmount('50000', 50000);

        expect(await openRequest(props)).toMatchObject(toggles);
    });

    it('counts unconfirmed funds for fund max with a saved default of 0', async () => {
        await renderView({
            confirmedBlockchainBalance: 0,
            unconfirmedBlockchainBalance: 100000,
            settings: { channels: { min_confs: 0 } }
        });
        await toggleFundMax();

        expect(amountInput().props.amount).toBe('100000');
    });
});

describe('OpenChannel min confs field', () => {
    it('treats a cleared field as unset and opens with the default of 1', async () => {
        const { props } = await renderView();
        await enterAmount('50000', 50000);
        await fireEvent.changeText(minConfsInput()!, '0');
        await fireEvent.changeText(minConfsInput()!, '');

        expect(minConfsInput()!.props.value).toBe('');

        const request = await openRequest(props);
        expect(request.min_confs).toBe(1);
        expect(request.spend_unconfirmed).toBe(false);
    });

    it('sends a typed 0 with spend unconfirmed', async () => {
        const { props } = await renderView();
        await enterAmount('50000', 50000);
        await fireEvent.changeText(minConfsInput()!, '0');

        const request = await openRequest(props);
        expect(request.min_confs).toBe(0);
        expect(request.spend_unconfirmed).toBe(true);
    });
});
