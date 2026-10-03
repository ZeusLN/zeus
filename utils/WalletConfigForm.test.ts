import { preserveUnspecifiedNodeFormFields } from './WalletConfigForm';
import ConnectionFormatUtils from './ConnectionFormatUtils';

describe('preserveUnspecifiedNodeFormFields', () => {
    it('keeps the user-ticked cert verification when the incoming node omits it', () => {
        expect(
            preserveUnspecifiedNodeFormFields(
                {},
                { certVerification: true, nickname: '' }
            )
        ).toEqual({ certVerification: true, nickname: '' });
    });

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

    it('keeps a typed nickname when the incoming node omits it', () => {
        expect(
            preserveUnspecifiedNodeFormFields(
                {},
                { certVerification: true, nickname: 'umbrel' }
            )
        ).toEqual({ certVerification: true, nickname: 'umbrel' });
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

        expect(node).not.toHaveProperty('certVerification');
        expect(node).not.toHaveProperty('nickname');
        expect(
            preserveUnspecifiedNodeFormFields(node, {
                certVerification: true,
                nickname: 'home node'
            })
        ).toEqual({
            certVerification: true,
            nickname: 'home node'
        });
    });
});
