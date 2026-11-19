jest.mock('react-native-encrypted-storage', () => ({
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve())
}));

jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: {} },
    fiatStore: {},
    nodeInfoStore: {
        nodeInfo: {
            isTestNet: false,
            isRegTest: false
        }
    }
}));

import AddressUtils from './AddressUtils';
import { buildOnChainUri, buildUnifiedUri } from './Bip21Utils';
import { decodeMemo } from './MemoUtils';

const ADDRESS = 'bcrt1qexampleaddress';
const ADDRESS_UPPER = 'BCRT1QEXAMPLEADDRESS';
const P2PKH = '1BoatSLRHtKNngkdXEeobR76b53LETtpyT';
const INVOICE = 'lnbcrt10005n1example';
const MAINNET_ADDRESS = 'BC1QAR0SRRR7XFKVY5L643LYDNW9RE59GTZZWF5MDQ';
const MAINNET_INVOICE = 'LNBC10U1PREALINVOICE';

const getMessages = (uri: string) =>
    (uri.split('?')[1] || '')
        .split('&')
        .filter((part) => part.startsWith('message='))
        .map((part) => part.split('=')[1]);

describe('Bip21Utils', () => {
    describe('buildOnChainUri', () => {
        it('gives a bare address when there is no amount or memo', () => {
            expect(buildOnChainUri({ address: ADDRESS, satAmount: '0' })).toBe(
                `bitcoin:${ADDRESS_UPPER}`
            );
            expect(
                buildOnChainUri({ address: ADDRESS, satAmount: '', memo: '' })
            ).toBe(`bitcoin:${ADDRESS_UPPER}`);
        });

        it('adds the amount', () => {
            expect(
                buildOnChainUri({ address: ADDRESS, satAmount: '1000' })
            ).toBe(`bitcoin:${ADDRESS_UPPER}?amount=0.00001`);
        });

        it('rounds a millisat amount up to whole sats', () => {
            expect(
                buildOnChainUri({ address: ADDRESS, satAmount: '1000.5' })
            ).toBe(`bitcoin:${ADDRESS_UPPER}?amount=0.00001001`);
        });

        it('adds a memo alone with spaces escaped', () => {
            expect(
                buildOnChainUri({
                    address: ADDRESS,
                    satAmount: '0',
                    memo: 'coffee and cake'
                })
            ).toBe(`bitcoin:${ADDRESS_UPPER}?message=coffee%20and%20cake`);
        });

        it('adds the amount and the memo', () => {
            expect(
                buildOnChainUri({
                    address: ADDRESS,
                    satAmount: 1000,
                    memo: 'coffee'
                })
            ).toBe(`bitcoin:${ADDRESS_UPPER}?amount=0.00001&message=coffee`);
        });

        it('leaves a mixed-case address unchanged', () => {
            expect(buildOnChainUri({ address: P2PKH, satAmount: '0' })).toBe(
                `bitcoin:${P2PKH}`
            );
        });
    });

    describe('buildUnifiedUri', () => {
        it('includes the uppercased invoice without an amount', () => {
            expect(
                buildUnifiedUri({
                    address: ADDRESS,
                    paymentRequest: INVOICE,
                    satAmount: '0'
                })
            ).toBe(
                `bitcoin:${ADDRESS_UPPER}?lightning=${INVOICE.toUpperCase()}`
            );
        });

        it('rounds a millisat amount up and keeps the memo', () => {
            expect(
                buildUnifiedUri({
                    address: ADDRESS,
                    paymentRequest: INVOICE,
                    satAmount: '1000.5',
                    memo: 'coffee and cake'
                })
            ).toBe(
                `bitcoin:${ADDRESS_UPPER}?lightning=${INVOICE.toUpperCase()}&amount=0.00001001&message=coffee%20and%20cake`
            );
        });

        it('leaves a mixed-case address unchanged', () => {
            expect(
                buildUnifiedUri({
                    address: P2PKH,
                    paymentRequest: INVOICE,
                    satAmount: '1000'
                })
            ).toBe(
                `bitcoin:${P2PKH}?lightning=${INVOICE.toUpperCase()}&amount=0.00001`
            );
        });
    });

    describe('memo encoding', () => {
        it('keeps &, = and lightning= in the memo inside one message param', () => {
            const memo = 'a&amount=1&lightning=lnbc1injected';
            const uri = buildUnifiedUri({
                address: MAINNET_ADDRESS,
                paymentRequest: MAINNET_INVOICE,
                satAmount: 1000,
                memo
            });
            expect(uri).toBe(
                `bitcoin:${MAINNET_ADDRESS}?lightning=${MAINNET_INVOICE}&amount=0.00001&message=a%26amount%3D1%26lightning%3Dlnbc1injected`
            );

            const { value, satAmount, lightning } =
                AddressUtils.processBIP21Uri(uri);
            expect(value).toBe(MAINNET_ADDRESS);
            expect(satAmount).toBe('1000');
            expect(lightning).toBe(MAINNET_INVOICE);

            const messages = getMessages(uri);
            expect(messages).toHaveLength(1);
            expect(decodeURIComponent(messages[0])).toBe(memo);
        });

        it('does not add an amount from the memo to an on-chain URI without one', () => {
            const uri = buildOnChainUri({
                address: MAINNET_ADDRESS,
                satAmount: '0',
                memo: 'tip&amount=21'
            });
            expect(uri).toBe(
                `bitcoin:${MAINNET_ADDRESS}?message=tip%26amount%3D21`
            );
            expect(AddressUtils.processBIP21Uri(uri).satAmount).toBeUndefined();
        });

        it('encodes #, ? and % so the URI still parses', () => {
            const uri = buildOnChainUri({
                address: MAINNET_ADDRESS,
                satAmount: '1000',
                memo: 'order #5? 100%'
            });
            expect(uri).toBe(
                `bitcoin:${MAINNET_ADDRESS}?amount=0.00001&message=order%20%235%3F%20100%25`
            );
            const { value, satAmount } = AddressUtils.processBIP21Uri(uri);
            expect(value).toBe(MAINNET_ADDRESS);
            expect(satAmount).toBe('1000');
        });

        it('percent-encodes unicode as UTF-8 and round-trips', () => {
            const memo = 'café ☕ 東京';
            const uri = buildOnChainUri({
                address: MAINNET_ADDRESS,
                satAmount: '0',
                memo
            });
            expect(uri).toBe(
                `bitcoin:${MAINNET_ADDRESS}?message=caf%C3%A9%20%E2%98%95%20%E6%9D%B1%E4%BA%AC`
            );
            expect(decodeURIComponent(getMessages(uri)[0])).toBe(memo);
        });

        it('round-trips through decodeMemo for display', () => {
            const memo = '100% legit & fast';
            const [encoded] = getMessages(
                buildOnChainUri({
                    address: MAINNET_ADDRESS,
                    satAmount: '0',
                    memo
                })
            );
            expect(decodeMemo(encoded)).toBe(memo);
        });

        it('omits a memo that cannot be encoded instead of throwing', () => {
            expect(
                buildOnChainUri({
                    address: MAINNET_ADDRESS,
                    satAmount: '0',
                    memo: '\uD800'
                })
            ).toBe(`bitcoin:${MAINNET_ADDRESS}`);
            expect(
                buildUnifiedUri({
                    address: MAINNET_ADDRESS,
                    paymentRequest: MAINNET_INVOICE,
                    satAmount: '0',
                    memo: '\uD800'
                })
            ).toBe(`bitcoin:${MAINNET_ADDRESS}?lightning=${MAINNET_INVOICE}`);
        });
    });
});
