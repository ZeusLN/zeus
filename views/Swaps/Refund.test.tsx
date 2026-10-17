jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../lndmobile/LndMobileInjection', () => ({
    swaps: { createRefundTransaction: jest.fn() }
}));
jest.mock('../../utils/BackendUtils', () => ({
    getMyNodeInfo: jest.fn(),
    supportsOnchainSends: () => false
}));
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

const nativeRefund = lndMobile.swaps.createRefundTransaction as jest.Mock;
const getMyNodeInfo = BackendUtils.getMyNodeInfo as jest.Mock;

const TIMEOUT = 900000;
const NOT_COSIGNED = 'could not create refund transaction: all outputs invalid';
const NON_FINAL = 'non-200 response: 400, body: non-final';

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

// Opens the refund screen, enters the destination and a 3 sat/vB fee, turns
// the uncooperative switch on if asked, and presses Initiate refund
const refund = async ({ uncooperative = false } = {}) => {
    const store = { updateSwapOnRefund: jest.fn().mockResolvedValue(true) };
    await render(
        <RefundSwap
            {...({
                navigation: { navigate: jest.fn(), setParams: jest.fn() },
                route: { params: { swapData: { ...SWAP } } },
                SwapStore: store,
                NodeInfoStore: { nodeInfo: { isTestNet: false } },
                InvoicesStore: {}
            } as any)}
        />
    );
    await fireEvent.changeText(hostOfType('AddressInput'), 'bc1qdestination');
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
    nativeRefund.mock.calls.map(([args]) => args.cooperative);

beforeEach(() => {
    nativeRefund.mockReset();
    getMyNodeInfo.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('RefundSwap refund button', () => {
    it('records a cooperative refund without looking up the tip', async () => {
        nativeRefund.mockResolvedValue('txid-coop');

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
        await fireEvent.changeText(hostOfType('AddressInput'), 'bc1qnext');
        refundEnabled();
    });

    it('hands native code the host without its /v2 suffix', async () => {
        nativeRefund.mockResolvedValue('txid');

        await refund();

        expect(nativeRefund.mock.calls[0][0]).toMatchObject({
            endpoint: 'https://provider.test',
            swapId: 'swap',
            transactionHex: 'lockuphex',
            feeRate: 3,
            timeoutBlockHeight: TIMEOUT,
            destinationAddress: 'bc1qdestination',
            lockupAddress: 'bc1plockup'
        });
    });

    it.each([TIMEOUT, TIMEOUT + 10])(
        'retries uncooperatively when the host will not co-sign and the tip is %s',
        async (tip) => {
            tipAt(tip);
            nativeRefund
                .mockRejectedValueOnce(new Error(NOT_COSIGNED))
                .mockResolvedValueOnce('txid-uncoop');

            const store = await refund();

            expect(cooperativeFlags()).toEqual([true, false]);
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
        nativeRefund.mockRejectedValue(new Error(NOT_COSIGNED));

        const store = await refund();

        expect(cooperativeFlags()).toEqual([true]);
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
            nativeRefund.mockRejectedValue(new Error(NOT_COSIGNED));

            await refund();

            expect(cooperativeFlags()).toEqual([true]);
            expect(errorShown()).toBe(
                'views.Swaps.refundNotCosigned after block 900,000. views.Swaps.turnOnUncooperativeRefund'
            );
        }
    );

    it('shows any other cooperative failure as is', async () => {
        tipAt(TIMEOUT + 10);
        nativeRefund.mockRejectedValue(new Error('fee too low'));

        await refund();

        expect(cooperativeFlags()).toEqual([true]);
        expect(uncooperativeOn()).toBe(false);
        expect(errorShown()).toBe('fee too low');
    });

    it('shows only the block message when an uncooperative refund is rejected as non-final', async () => {
        tipAt(TIMEOUT - 3);
        nativeRefund.mockRejectedValue(new Error(NON_FINAL));

        await refund({ uncooperative: true });

        expect(cooperativeFlags()).toEqual([false]);
        expect(errorShown()).toBe('after block 900,000 (3 to go).');
    });

    it('shows any other uncooperative failure as is', async () => {
        tipAt(TIMEOUT + 10);
        nativeRefund.mockRejectedValue(new Error('invalid address'));

        await refund({ uncooperative: true });

        expect(errorShown()).toBe('invalid address');
    });

    it('shows the retry error, and records nothing, when the uncooperative retry fails', async () => {
        tipAt(TIMEOUT);
        nativeRefund
            .mockRejectedValueOnce(new Error(NOT_COSIGNED))
            .mockRejectedValueOnce(new Error('broadcast failed'));

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

describe('RefundSwap raw details', () => {
    const rawDetails = async () => {
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
        return screen.container
            .queryAll((n) => n.type === 'KeyValue')
            .map((n) => n.props);
    };

    it('does not show the refund private key', async () => {
        const rows = await rawDetails();

        expect(rows.map((row) => row.keyValue)).not.toContain('privateKey');
        expect(rows.map((row) => row.value)).not.toContain(
            SWAP.refundPrivateKey
        );
    });

    it('still shows the public swap details', async () => {
        const rows = await rawDetails();

        expect(rows).toContainEqual(
            expect.objectContaining({
                keyValue: 'servicePubKey',
                value: SWAP.servicePubKey
            })
        );
        expect(rows).toContainEqual(
            expect.objectContaining({ keyValue: 'swapId', value: SWAP.id })
        );
    });
});
