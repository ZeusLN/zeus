jest.mock('../stores/Stores', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

import Transaction from './Transaction';

describe('Transaction.isConfirmed', () => {
    it('is false for an unconfirmed lnd-style transaction', () => {
        expect(new Transaction({ num_confirmations: 0 }).isConfirmed).toBe(
            false
        );
        expect(new Transaction({}).isConfirmed).toBe(false);
    });

    it('is true once confirmations exist or status is confirmed', () => {
        expect(new Transaction({ num_confirmations: 3 }).isConfirmed).toBe(
            true
        );
        expect(new Transaction({ status: 'confirmed' }).isConfirmed).toBe(true);
    });
});

describe('Transaction.getStatusDisplay', () => {
    it('reports unconfirmed for lnd-style transactions with no status field', () => {
        // lnd, embedded LND, LNC, and CLN transactions carry no status
        // field; before the fix this returned '' for pending transactions
        expect(new Transaction({ num_confirmations: 0 }).getStatusDisplay).toBe(
            'general.unconfirmed'
        );
        expect(new Transaction({}).getStatusDisplay).toBe(
            'general.unconfirmed'
        );
    });

    it('reports unconfirmed for LDK Node pending transactions', () => {
        expect(
            new Transaction({ num_confirmations: 0, status: 'pending' })
                .getStatusDisplay
        ).toBe('general.unconfirmed');
    });

    it('reports confirmed for confirmed transactions', () => {
        expect(new Transaction({ num_confirmations: 6 }).getStatusDisplay).toBe(
            'general.confirmed'
        );
        expect(new Transaction({ status: 'confirmed' }).getStatusDisplay).toBe(
            'general.confirmed'
        );
    });

    it('passes through unknown backend status strings', () => {
        expect(new Transaction({ status: 'replaced' }).getStatusDisplay).toBe(
            'replaced'
        );
    });
});
