import { buildOnChainUri, buildUnifiedUri } from './Bip21Utils';

jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: {} },
    fiatStore: {}
}));

const ADDRESS = 'bcrt1qexampleaddress';
const ADDRESS_UPPER = 'BCRT1QEXAMPLEADDRESS';
const P2PKH = '1BoatSLRHtKNngkdXEeobR76b53LETtpyT';
const INVOICE = 'lnbcrt10005n1example';

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
});
