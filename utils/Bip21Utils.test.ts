jest.mock('react-native-encrypted-storage', () => ({
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve())
}));

jest.mock('../stores/Stores', () => ({
    nodeInfoStore: {
        nodeInfo: {
            isTestNet: false,
            isRegTest: false
        }
    }
}));

import AddressUtils from './AddressUtils';
import { buildBip21Uri } from './Bip21Utils';
import { decodeMemo } from './MemoUtils';

const ADDRESS = 'BC1QAR0SRRR7XFKVY5L643LYDNW9RE59GTZZWF5MDQ';
const INVOICE = 'LNBC10U1PREALINVOICE';

const getMessage = (uri: string) => {
    const params = uri.split('?')[1] || '';
    const messages = params
        .split('&')
        .filter((part) => part.startsWith('message='))
        .map((part) => part.split('=')[1]);
    return messages;
};

describe('Bip21Utils.buildBip21Uri', () => {
    it('keeps &, = and lightning= in the memo inside a single message param', () => {
        const memo = 'a&amount=1&lightning=lnbc1injected';
        const uri = buildBip21Uri({
            address: ADDRESS,
            lightning: INVOICE,
            satAmount: 1000,
            message: memo
        });
        expect(uri).toBe(
            `bitcoin:${ADDRESS}?lightning=${INVOICE}&amount=0.00001&message=a%26amount%3D1%26lightning%3Dlnbc1injected`
        );

        const { value, satAmount, lightning } =
            AddressUtils.processBIP21Uri(uri);
        expect(value).toBe(ADDRESS);
        expect(satAmount).toBe('1000');
        expect(lightning).toBe(INVOICE);

        const messages = getMessage(uri);
        expect(messages).toHaveLength(1);
        expect(decodeURIComponent(messages[0])).toBe(memo);
    });

    it('does not add an amount from the memo to an on-chain URI without one', () => {
        const uri = buildBip21Uri({
            address: ADDRESS,
            message: 'tip&amount=21'
        });
        expect(uri).toBe(`bitcoin:${ADDRESS}?message=tip%26amount%3D21`);
        expect(AddressUtils.processBIP21Uri(uri).satAmount).toBeUndefined();
    });

    it('encodes # and ? so they do not end the URI or start a new query', () => {
        const uri = buildBip21Uri({
            address: ADDRESS,
            message: 'order #5? 100%'
        });
        expect(uri).toBe(`bitcoin:${ADDRESS}?message=order%20%235%3F%20100%25`);
    });

    it('encodes spaces as %20', () => {
        expect(
            buildBip21Uri({
                address: ADDRESS,
                satAmount: '1000',
                message: 'Pay to Alice'
            })
        ).toBe(`bitcoin:${ADDRESS}?amount=0.00001&message=Pay%20to%20Alice`);
    });

    it('percent-encodes unicode as UTF-8 and round-trips', () => {
        const memo = 'café ☕ 東京';
        const uri = buildBip21Uri({ address: ADDRESS, message: memo });
        expect(uri).toBe(
            `bitcoin:${ADDRESS}?message=caf%C3%A9%20%E2%98%95%20%E6%9D%B1%E4%BA%AC`
        );
        expect(decodeURIComponent(getMessage(uri)[0])).toBe(memo);
    });

    it('round-trips through decodeMemo for display', () => {
        const memo = '100% legit & fast';
        const [encoded] = getMessage(
            buildBip21Uri({ address: ADDRESS, message: memo })
        );
        expect(decodeMemo(encoded)).toBe(memo);
    });

    it('returns the bare address when there is no memo or amount', () => {
        expect(buildBip21Uri({ address: ADDRESS })).toBe(`bitcoin:${ADDRESS}`);
        expect(buildBip21Uri({ address: ADDRESS, message: '' })).toBe(
            `bitcoin:${ADDRESS}`
        );
        expect(
            buildBip21Uri({ address: ADDRESS, satAmount: 0, message: '' })
        ).toBe(`bitcoin:${ADDRESS}`);
    });

    it('does not interpolate "undefined" for an undefined memo', () => {
        const uri = buildBip21Uri({
            address: ADDRESS,
            satAmount: '',
            message: undefined
        });
        expect(uri).toBe(`bitcoin:${ADDRESS}`);
        expect(uri).not.toContain('undefined');
    });

    it('adds only the amount when there is no memo', () => {
        expect(
            buildBip21Uri({ address: ADDRESS, satAmount: '150000000' })
        ).toBe(`bitcoin:${ADDRESS}?amount=1.5`);
        expect(
            buildBip21Uri({
                address: ADDRESS,
                lightning: INVOICE,
                satAmount: 1
            })
        ).toBe(`bitcoin:${ADDRESS}?lightning=${INVOICE}&amount=0.00000001`);
    });

    it('builds a unified URI without amount or memo', () => {
        expect(buildBip21Uri({ address: ADDRESS, lightning: INVOICE })).toBe(
            `bitcoin:${ADDRESS}?lightning=${INVOICE}`
        );
    });

    it('omits a memo that cannot be encoded instead of throwing', () => {
        expect(buildBip21Uri({ address: ADDRESS, message: '\uD800' })).toBe(
            `bitcoin:${ADDRESS}`
        );
    });
});
