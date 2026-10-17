jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../lndmobile/LndMobileInjection', () => ({
    swaps: { buildRefundTransaction: jest.fn() }
}));
jest.mock('../../utils/BackendUtils', () => ({
    getMyNodeInfo: jest.fn(),
    supportsOnchainSends: () => false
}));
// AddressUtils reads the connected node's network from here
jest.mock('../../stores/Stores', () => ({ nodeInfoStore: { nodeInfo: {} } }));
jest.mock('../../models/NodeInfo', () => ({
    __esModule: true,
    default: class {
        currentBlockHeight: number;
        constructor(data: any) {
            this.currentBlockHeight = data?.block_height || 0;
        }
    }
}));
// the block messages carry placeholders; everything else reads as its key
jest.mock('../../utils/LocaleUtils', () => {
    const templates: { [key: string]: string } = {
        'views.Swaps.uncooperativeRefundAfterBlocks':
            'after block {{block}} ({{blocks}} to go).',
        'views.Swaps.uncooperativeRefundAfterBlock': 'after block {{block}}.'
    };
    return {
        localeString: (key: string) => templates[key] ?? key,
        pascalToHumanReadable: (s: string) => s
    };
});
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#000' }));
jest.mock('../../utils/UnitsUtils', () => ({
    numberWithCommas: (x: number | string) =>
        String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}));
// the real SwapUtils touches the filesystem and save dialog for the rescue
// key export; neither is exercised here
jest.mock('@react-native-documents/picker', () => ({
    saveDocuments: jest.fn()
}));
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <Pressable role="button" onPress={onPress} disabled={disabled}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/OnchainFeeInput', () => 'OnchainFeeInput');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/Accordion', () => 'Accordion');
jest.mock('../../components/AddressInput', () => 'AddressInput');
jest.mock('../../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        ErrorMessage: ({ message }: any) => (
            <Text testID="error">{message}</Text>
        ),
        SuccessMessage: ({ message }: any) => (
            <Text testID="success">{message}</Text>
        )
    };
});
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import RefundSwap from './Refund';
import lndMobile from '../../lndmobile/LndMobileInjection';
import BackendUtils from '../../utils/BackendUtils';
import { nodeInfoStore } from '../../stores/Stores';

const nativeBuild = lndMobile.swaps.buildRefundTransaction as jest.Mock;
const getMyNodeInfo = BackendUtils.getMyNodeInfo as jest.Mock;

const TIMEOUT = 900000;
const DESTINATION = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const NEXT_DESTINATION = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const NOT_COSIGNED = 'could not create refund transaction: all outputs invalid';
// broadcastSwapTransaction's error when neither the mempool instance nor
// the host takes a transaction whose locktime is above the tip
const NON_FINAL =
    'https://mempool.space/api: 400 sendrawtransaction RPC error: {"code":-26,"message":"non-final"}; https://provider.test/v2: 400 {"error":"non-final"}';

const SWAP = {
    id: 'swap',
    endpoint: 'https://provider.test/v2',
    swapTreeDetails: {
        claimLeaf: { output: 'c1' },
        refundLeaf: { output: 'r1' }
    },
    lockupTransaction: { hex: 'lockuphex' },
    refundPrivateKey: 'priv',
    servicePubKey: 'pub',
    timeoutBlockHeight: TIMEOUT,
    effectiveLockupAddress: 'bc1plockup'
};

const hostOfType = (type: string) =>
    screen.container.queryAll((n) => n.type === type)[0];

// broadcastSwapTransaction for the next refund; reset before each test
let broadcast: jest.Mock;

// Opens the refund screen, enters the destination and a 3 sat/vB fee, turns
// the uncooperative switch on if asked, and presses Initiate refund
const refund = async ({
    uncooperative = false,
    nodeInfo = {}
}: { uncooperative?: boolean; nodeInfo?: any } = {}) => {
    const store = {
        updateSwapOnRefund: jest.fn().mockResolvedValue(true),
        broadcastSwapTransaction: broadcast
    };
    await render(
        <RefundSwap
            {...({
                navigation: { navigate: jest.fn(), setParams: jest.fn() },
                route: { params: { swapData: { ...SWAP } } },
                SwapStore: store,
                NodeInfoStore: { nodeInfo },
                InvoicesStore: {}
            } as any)}
        />
    );
    await fireEvent.changeText(hostOfType('AddressInput'), DESTINATION);
    await fireEvent(hostOfType('OnchainFeeInput'), 'changeFee', '3');
    if (uncooperative) {
        await fireEvent(hostOfType('Switch'), 'valueChange', true);
    }
    await fireEvent.press(
        screen.getByRole('button', { name: 'views.Swaps.initiateRefund' })
    );
    return store;
};

const errorShown = () => screen.queryByTestId('error')?.props.children;
const successShown = () => screen.queryByTestId('success')?.props.children;
const uncooperativeOn = () => hostOfType('Switch').props.value;
const refundEnabled = () =>
    expect(
        screen.getByRole('button', { name: 'views.Swaps.initiateRefund' })
    ).toBeEnabled();

const tipAt = (height: number) =>
    getMyNodeInfo.mockResolvedValue({ block_height: height });

const cooperativeFlags = () =>
    nativeBuild.mock.calls.map(([args]) => args.cooperative);

beforeEach(() => {
    nativeBuild.mockReset();
    nativeBuild.mockResolvedValue('signedhex');
    broadcast = jest.fn();
    getMyNodeInfo.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('RefundSwap refund button', () => {
    it('records a cooperative refund without looking up the tip', async () => {
        broadcast.mockResolvedValue('txid-coop');

        const store = await refund();

        expect(cooperativeFlags()).toEqual([true]);
        expect(getMyNodeInfo).not.toHaveBeenCalled();
        expect(store.updateSwapOnRefund).toHaveBeenCalledWith(
            'swap',
            'txid-coop'
        );
        expect(successShown()).toContain('txid-coop');
        expect(errorShown()).toBeUndefined();
        // the destination is cleared, so the button waits for a new one
        expect(hostOfType('AddressInput').props.value).toBe('');
        // a new destination enables it again, so loading was reset
        await fireEvent.changeText(
            hostOfType('AddressInput'),
            NEXT_DESTINATION
        );
        refundEnabled();
    });

    it('hands native code the host without its /v2 suffix', async () => {
        broadcast.mockResolvedValue('txid');

        await refund();

        expect(nativeBuild.mock.calls[0][0]).toMatchObject({
            endpoint: 'https://provider.test',
            swapId: 'swap',
            transactionHex: 'lockuphex',
            feeRate: 3,
            timeoutBlockHeight: TIMEOUT,
            destinationAddress: DESTINATION,
            lockupAddress: 'bc1plockup',
            network: 'mainnet'
        });
    });

    it('hands native code the host without its /v2 suffix on the uncooperative retry too', async () => {
        tipAt(TIMEOUT);
        nativeBuild
            .mockRejectedValueOnce(new Error(NOT_COSIGNED))
            .mockResolvedValueOnce('hex-uncoop');
        broadcast.mockResolvedValue('txid-uncoop');

        await refund();

        expect(nativeBuild.mock.calls.map(([args]) => args.endpoint)).toEqual([
            'https://provider.test',
            'https://provider.test'
        ]);
    });

    it('shows the host without its /v2 suffix in the raw details', async () => {
        broadcast.mockResolvedValue('txid');

        await refund();

        const endpointRow = screen.container.queryAll(
            (n) => n.type === 'KeyValue' && n.props.keyValue === 'endpoint'
        )[0];
        expect(endpointRow?.props.value).toBe('https://provider.test');
    });

    it.each([
        [{ isTestNet: true }, 'testnet'],
        [{ isSigNet: true }, 'testnet'],
        [{ isRegTest: true }, 'regtest']
    ])(
        'builds the refund for the node network %j as %s',
        async (nodeInfo, network) => {
            broadcast.mockResolvedValue('txid');

            await refund({ nodeInfo });

            expect(nativeBuild.mock.calls[0][0].network).toBe(network);
        }
    );

    it('broadcasts the signed refund from the app, with the host as fallback', async () => {
        broadcast.mockResolvedValue('txid');

        await refund();

        expect(broadcast).toHaveBeenCalledTimes(1);
        expect(broadcast).toHaveBeenCalledWith(
            'signedhex',
            'https://provider.test/v2'
        );
    });

    it.each([TIMEOUT, TIMEOUT + 10])(
        'retries uncooperatively when the host will not co-sign and the tip is %s',
        async (tip) => {
            tipAt(tip);
            nativeBuild
                .mockRejectedValueOnce(new Error(NOT_COSIGNED))
                .mockResolvedValueOnce('hex-uncoop');
            broadcast.mockResolvedValue('txid-uncoop');

            const store = await refund();

            expect(cooperativeFlags()).toEqual([true, false]);
            expect(broadcast).toHaveBeenCalledTimes(1);
            expect(broadcast).toHaveBeenCalledWith('hex-uncoop', SWAP.endpoint);
            expect(uncooperativeOn()).toBe(true);
            expect(store.updateSwapOnRefund).toHaveBeenCalledWith(
                'swap',
                'txid-uncoop'
            );
            expect(successShown()).toContain('txid-uncoop');
            expect(errorShown()).toBeUndefined();
        }
    );

    it('says when an uncooperative refund becomes possible if the timeout is ahead', async () => {
        tipAt(TIMEOUT - 1234);
        nativeBuild.mockRejectedValue(new Error(NOT_COSIGNED));

        const store = await refund();

        expect(cooperativeFlags()).toEqual([true]);
        expect(broadcast).not.toHaveBeenCalled();
        expect(uncooperativeOn()).toBe(false);
        expect(errorShown()).toBe(
            'views.Swaps.refundNotCosigned after block 900,000 (1,234 to go). views.Swaps.turnOnUncooperativeRefund'
        );
        refundEnabled();
        expect(store.updateSwapOnRefund).not.toHaveBeenCalled();
    });

    it.each([
        [
            'the node cannot be reached',
            () => getMyNodeInfo.mockRejectedValue(new Error('offline'))
        ],
        [
            'the node reports no height',
            () => getMyNodeInfo.mockResolvedValue({})
        ]
    ])(
        'leaves out the block count, and does not retry, when %s',
        async (_, setUpTip) => {
            setUpTip();
            nativeBuild.mockRejectedValue(new Error(NOT_COSIGNED));

            await refund();

            expect(cooperativeFlags()).toEqual([true]);
            expect(errorShown()).toBe(
                'views.Swaps.refundNotCosigned after block 900,000. views.Swaps.turnOnUncooperativeRefund'
            );
        }
    );

    it('shows any other cooperative failure as is', async () => {
        tipAt(TIMEOUT + 10);
        nativeBuild.mockRejectedValue(new Error('fee too low'));

        await refund();

        expect(cooperativeFlags()).toEqual([true]);
        expect(uncooperativeOn()).toBe(false);
        expect(errorShown()).toBe('fee too low');
    });

    it('shows only the block message when an uncooperative refund is rejected as non-final', async () => {
        tipAt(TIMEOUT - 3);
        broadcast.mockRejectedValue(new Error(NON_FINAL));

        await refund({ uncooperative: true });

        expect(cooperativeFlags()).toEqual([false]);
        expect(errorShown()).toBe('after block 900,000 (3 to go).');
    });

    it('shows any other uncooperative failure as is', async () => {
        tipAt(TIMEOUT + 10);
        nativeBuild.mockRejectedValue(new Error('invalid address'));

        await refund({ uncooperative: true });

        expect(errorShown()).toBe('invalid address');
    });

    it('shows the retry error, and records nothing, when the uncooperative retry fails', async () => {
        tipAt(TIMEOUT);
        nativeBuild.mockRejectedValueOnce(new Error(NOT_COSIGNED));
        broadcast.mockRejectedValue(new Error('broadcast failed'));

        const store = await refund();

        expect(cooperativeFlags()).toEqual([true, false]);
        expect(uncooperativeOn()).toBe(true);
        expect(errorShown()).toBe('broadcast failed');
        refundEnabled();
        expect(store.updateSwapOnRefund).not.toHaveBeenCalled();
    });

    it('keeps the button disabled until a destination is entered', async () => {
        await render(
            <RefundSwap
                {...({
                    navigation: { navigate: jest.fn(), setParams: jest.fn() },
                    route: { params: { swapData: { ...SWAP } } },
                    SwapStore: {},
                    NodeInfoStore: { nodeInfo: { isTestNet: false } },
                    InvoicesStore: {}
                } as any)}
            />
        );

        expect(
            screen.getByRole('button', { name: 'views.Swaps.initiateRefund' })
        ).toBeDisabled();
    });
});

describe('RefundSwap destination', () => {
    const TESTNET = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

    afterEach(() => {
        (nodeInfoStore as any).nodeInfo = {};
    });

    const enter = async (destination: string) => {
        await render(
            <RefundSwap
                {...({
                    navigation: { navigate: jest.fn(), setParams: jest.fn() },
                    route: { params: { swapData: { ...SWAP } } },
                    SwapStore: {},
                    NodeInfoStore: { nodeInfo: nodeInfoStore.nodeInfo },
                    InvoicesStore: {}
                } as any)}
            />
        );
        await fireEvent.changeText(hostOfType('AddressInput'), destination);
        return screen.getByRole('button', {
            name: 'views.Swaps.initiateRefund'
        });
    };

    it('accepts an address of the node network', async () => {
        expect(await enter(DESTINATION)).toBeEnabled();
    });

    it('accepts a testnet address on a testnet node', async () => {
        (nodeInfoStore as any).nodeInfo = { isTestNet: true };
        expect(await enter(TESTNET)).toBeEnabled();
    });

    it.each([
        ['a testnet address', TESTNET],
        ['a regtest address', 'bcrt1qqgdrlt97x4847rf85utak8gre5q7k83uwh3ajj'],
        ['a testnet base58 address', 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn'],
        [
            'a public key',
            '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
        ]
    ])('refuses %s on a mainnet node', async (_, destination) => {
        expect(await enter(destination)).toBeDisabled();
    });

    it('refuses a mainnet address on a testnet node', async () => {
        (nodeInfoStore as any).nodeInfo = { isTestNet: true };
        expect(await enter(DESTINATION)).toBeDisabled();
    });
});
