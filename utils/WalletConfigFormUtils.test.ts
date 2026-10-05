import { preserveUnspecifiedNodeFormFields } from './WalletConfigFormUtils';
import ConnectionFormatUtils from './ConnectionFormatUtils';

describe('preserveUnspecifiedNodeFormFields', () => {
    it('keeps both current values when the incoming node omits them', () => {
        expect(
            preserveUnspecifiedNodeFormFields(
                {},
                { certVerification: true, nickname: 'umbrel' }
            )
        ).toEqual({ certVerification: true, nickname: 'umbrel' });
    });

    // `??` rather than `||`: an unticked box is a real value the user chose,
    // not an absent one, so it must survive a scan unchanged.
    it('keeps cert verification unchecked when the user left it off', () => {
        expect(
            preserveUnspecifiedNodeFormFields(
                {},
                { certVerification: false, nickname: '' }
            )
        ).toEqual({ certVerification: false, nickname: '' });
    });

    it('uses an explicit incoming certVerification over current form state', () => {
        expect(
            preserveUnspecifiedNodeFormFields(
                { certVerification: false },
                { certVerification: true, nickname: 'home' }
            )
        ).toEqual({ certVerification: false, nickname: 'home' });
    });

    it('uses an explicit incoming nickname over current form state', () => {
        expect(
            preserveUnspecifiedNodeFormFields(
                { nickname: 'remote' },
                { certVerification: true, nickname: 'umbrel' }
            )
        ).toEqual({ certVerification: true, nickname: 'remote' });
    });

    it('preserves both fields for a parsed lndconnect node', () => {
        const node = ConnectionFormatUtils.processLndConnectUrl(
            'lndconnect://8.8.0.0:2056?&macaroon=0201b6'
        );

        // The parsed payload carries neither field...
        expect(node).not.toHaveProperty('certVerification');
        expect(node).not.toHaveProperty('nickname');

        // ...so the values WalletConfiguration destructures out of it are both
        // undefined. Destructuring here rather than passing `node` straight in
        // mirrors the production call site, which spreads a
        // `{ certVerification, nickname }` literal, not the whole node.
        const { certVerification, nickname } = node as Partial<{
            certVerification: boolean;
            nickname: string;
        }>;

        expect(
            preserveUnspecifiedNodeFormFields(
                { certVerification, nickname },
                {
                    certVerification: true,
                    nickname: 'home node'
                }
            )
        ).toEqual({
            certVerification: true,
            nickname: 'home node'
        });
    });

    // Every other QR payload routed to WalletConfiguration omits both fields
    // too, so this fix is not lndconnect-specific. LNDHub is the one exception:
    // it sets `certVerification: true` explicitly, and `??` keeps that winning.
    it('preserves both fields for a parsed CLNRest node', () => {
        const node = ConnectionFormatUtils.processCLNRestConnectUrl(
            'clnrest://8.8.0.0:3010?rune=abc'
        );

        expect(node).not.toHaveProperty('certVerification');
        expect(node).not.toHaveProperty('nickname');

        const { certVerification, nickname } = node as Partial<{
            certVerification: boolean;
            nickname: string;
        }>;

        expect(
            preserveUnspecifiedNodeFormFields(
                { certVerification, nickname },
                { certVerification: true, nickname: 'my cln' }
            )
        ).toEqual({ certVerification: true, nickname: 'my cln' });
    });

    it('lets an LNDHub payload keep forcing cert verification on', () => {
        expect(
            preserveUnspecifiedNodeFormFields(
                { certVerification: true },
                { certVerification: false, nickname: 'hub' }
            )
        ).toEqual({ certVerification: true, nickname: 'hub' });
    });
});
