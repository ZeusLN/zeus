jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../lndmobile/LndMobileInjection', () => ({
    swaps: { createRefundTransaction: jest.fn() }
}));
jest.mock('../../utils/BackendUtils', () => ({
    getMyNodeInfo: jest.fn(),
    supportsOnchainSends: () => true
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
jest.mock('react-native-fs', () => ({}));
jest.mock('@react-native-documents/picker', () => ({
    saveDocuments: jest.fn()
}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/OnchainFeeInput', () => 'OnchainFeeInput');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/Accordion', () => 'Accordion');
jest.mock('../../components/AddressInput', () => 'AddressInput');
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage',
    SuccessMessage: 'SuccessMessage'
}));
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));

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

const makeView = ({ uncooperative = false } = {}) => {
    const store = { updateSwapOnRefund: jest.fn().mockResolvedValue(true) };
    const view = new RefundSwap({
        navigation: {},
        route: { params: { swapData: SWAP } },
        SwapStore: store,
        NodeInfoStore: { nodeInfo: { isTestNet: false } }
    } as any);
    jest.spyOn(view, 'setState').mockImplementation((update: any) => {
        view.state = { ...view.state, ...update };
    });
    view.state = { ...view.state, uncooperative };
    const refund = () =>
        view.createRefundTransaction(SWAP as any, '3', 'bc1qdestination');
    return { store, view, refund };
};

const tipAt = (height: number) =>
    getMyNodeInfo.mockResolvedValue({ block_height: height });

const cooperativeFlags = () =>
    nativeRefund.mock.calls.map(([args]) => args.cooperative);

beforeEach(() => {
    nativeRefund.mockReset();
    getMyNodeInfo.mockReset();
});

describe('RefundSwap.createRefundTransaction', () => {
    it('records a cooperative refund without looking up the tip', async () => {
        const { store, view, refund } = makeView();
        nativeRefund.mockResolvedValue('txid-coop');

        await refund();

        expect(cooperativeFlags()).toEqual([true]);
        expect(getMyNodeInfo).not.toHaveBeenCalled();
        expect(store.updateSwapOnRefund).toHaveBeenCalledWith(
            'swap',
            'txid-coop'
        );
        expect(view.state.refundStatus).toContain('txid-coop');
        expect(view.state.error).toBe('');
        expect(view.state.loading).toBe(false);
    });

    it('hands native code the host without its /v2 suffix', async () => {
        const { refund } = makeView();
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
            const { store, view, refund } = makeView();
            tipAt(tip);
            nativeRefund
                .mockRejectedValueOnce(new Error(NOT_COSIGNED))
                .mockResolvedValueOnce('txid-uncoop');

            await refund();

            expect(cooperativeFlags()).toEqual([true, false]);
            expect(view.state.uncooperative).toBe(true);
            expect(store.updateSwapOnRefund).toHaveBeenCalledWith(
                'swap',
                'txid-uncoop'
            );
            expect(view.state.refundStatus).toContain('txid-uncoop');
            expect(view.state.error).toBe('');
        }
    );

    it('hands native code the host without its /v2 suffix on the uncooperative retry too', async () => {
        const { refund } = makeView();
        tipAt(TIMEOUT);
        nativeRefund
            .mockRejectedValueOnce(new Error(NOT_COSIGNED))
            .mockResolvedValueOnce('txid-uncoop');

        await refund();

        expect(nativeRefund.mock.calls.map(([args]) => args.endpoint)).toEqual([
            'https://provider.test',
            'https://provider.test'
        ]);
    });

    it('shows the host without its /v2 suffix in the raw details', () => {
        const { view } = makeView();
        const findEndpointRow = (node: any): any => {
            if (!node || typeof node !== 'object') return undefined;
            if (Array.isArray(node)) {
                for (const child of node) {
                    const found = findEndpointRow(child);
                    if (found) return found;
                }
                return undefined;
            }
            if (node.type === 'KeyValue' && node.key === 'endpoint') {
                return node;
            }
            return findEndpointRow(node.props?.children);
        };

        const row = findEndpointRow(view.render());

        expect(row?.props.value).toBe('https://provider.test');
    });

    it('says when an uncooperative refund becomes possible if the timeout is ahead', async () => {
        const { store, view, refund } = makeView();
        tipAt(TIMEOUT - 1234);
        nativeRefund.mockRejectedValue(new Error(NOT_COSIGNED));

        await expect(refund()).rejects.toThrow(NOT_COSIGNED);

        expect(cooperativeFlags()).toEqual([true]);
        expect(view.state.uncooperative).toBe(false);
        expect(view.state.error).toBe(
            'views.Swaps.refundNotCosigned after block 900,000 (1,234 to go). views.Swaps.turnOnUncooperativeRefund'
        );
        expect(view.state.loading).toBe(false);
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
            const { view, refund } = makeView();
            setUpTip();
            nativeRefund.mockRejectedValue(new Error(NOT_COSIGNED));

            await expect(refund()).rejects.toThrow(NOT_COSIGNED);

            expect(cooperativeFlags()).toEqual([true]);
            expect(view.state.error).toBe(
                'views.Swaps.refundNotCosigned after block 900,000. views.Swaps.turnOnUncooperativeRefund'
            );
        }
    );

    it('shows any other cooperative failure as is', async () => {
        const { view, refund } = makeView();
        tipAt(TIMEOUT + 10);
        nativeRefund.mockRejectedValue(new Error('fee too low'));

        await expect(refund()).rejects.toThrow('fee too low');

        expect(cooperativeFlags()).toEqual([true]);
        expect(view.state.uncooperative).toBe(false);
        expect(view.state.error).toBe('fee too low');
    });

    it('shows only the block message when an uncooperative refund is rejected as non-final', async () => {
        const { view, refund } = makeView({ uncooperative: true });
        tipAt(TIMEOUT - 3);
        nativeRefund.mockRejectedValue(new Error(NON_FINAL));

        await expect(refund()).rejects.toThrow(NON_FINAL);

        expect(cooperativeFlags()).toEqual([false]);
        expect(view.state.error).toBe('after block 900,000 (3 to go).');
    });

    it('shows any other uncooperative failure as is', async () => {
        const { view, refund } = makeView({ uncooperative: true });
        tipAt(TIMEOUT + 10);
        nativeRefund.mockRejectedValue(new Error('invalid address'));

        await expect(refund()).rejects.toThrow('invalid address');

        expect(view.state.error).toBe('invalid address');
    });

    it('shows the retry error, and records nothing, when the uncooperative retry fails', async () => {
        const { store, view, refund } = makeView();
        tipAt(TIMEOUT);
        nativeRefund
            .mockRejectedValueOnce(new Error(NOT_COSIGNED))
            .mockRejectedValueOnce(new Error('broadcast failed'));

        await expect(refund()).rejects.toThrow('broadcast failed');

        expect(cooperativeFlags()).toEqual([true, false]);
        expect(view.state.uncooperative).toBe(true);
        expect(view.state.error).toBe('broadcast failed');
        expect(view.state.loading).toBe(false);
        expect(store.updateSwapOnRefund).not.toHaveBeenCalled();
    });
});
