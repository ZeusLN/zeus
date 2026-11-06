jest.mock('react-native-randombytes', () => ({
    randomBytes: (n: number) => jest.requireActual('crypto').randomBytes(n)
}));

import {
    SEND_LABEL_PREFIX,
    findSentTransaction,
    makeSendLabel
} from './OnchainSendUtils';

describe('makeSendLabel', () => {
    it('is the prefix plus 16 hex characters', () => {
        const label = makeSendLabel();
        expect(label.startsWith(SEND_LABEL_PREFIX)).toBe(true);
        expect(label.slice(SEND_LABEL_PREFIX.length)).toMatch(/^[0-9a-f]{16}$/);
    });

    it('differs between sends', () => {
        expect(makeSendLabel()).not.toEqual(makeSendLabel());
    });
});

describe('findSentTransaction', () => {
    const label = 'ZEUS send 0011223344556677';
    const isSent = (tx: any) => tx.label === label;
    const options = { attempts: 3, delayMs: 0 };

    it('resolves the txid of the transaction that matches', async () => {
        const getTransactions = jest.fn().mockResolvedValue({
            transactions: [
                { tx_hash: 'other', label: '' },
                { tx_hash: 'sent', label }
            ]
        });

        await expect(
            findSentTransaction(getTransactions, isSent, options)
        ).resolves.toBe('sent');
        expect(getTransactions).toHaveBeenCalledTimes(1);
    });

    it('keeps looking after a failed lookup', async () => {
        const getTransactions = jest
            .fn()
            .mockRejectedValueOnce(new Error('Request timeout'))
            .mockResolvedValueOnce({
                transactions: [{ tx_hash: 'sent', label }]
            });

        await expect(
            findSentTransaction(getTransactions, isSent, options)
        ).resolves.toBe('sent');
        expect(getTransactions).toHaveBeenCalledTimes(2);
    });

    it('keeps looking until the send shows up', async () => {
        const getTransactions = jest
            .fn()
            .mockResolvedValueOnce({ transactions: [] })
            .mockResolvedValueOnce({
                transactions: [{ tx_hash: 'sent', label }]
            });

        await expect(
            findSentTransaction(getTransactions, isSent, options)
        ).resolves.toBe('sent');
    });

    it('resolves undefined after the last attempt', async () => {
        const getTransactions = jest.fn().mockResolvedValue({
            transactions: [{ tx_hash: 'other', label: 'ZEUS send ffff' }]
        });

        await expect(
            findSentTransaction(getTransactions, isSent, options)
        ).resolves.toBeUndefined();
        expect(getTransactions).toHaveBeenCalledTimes(3);
    });

    it('skips empty entries', async () => {
        const getTransactions = jest.fn().mockResolvedValue({
            transactions: [null, { tx_hash: 'sent', label }]
        });

        await expect(
            findSentTransaction(getTransactions, isSent, options)
        ).resolves.toBe('sent');
    });

    it('tolerates a response without transactions', async () => {
        const getTransactions = jest.fn().mockResolvedValue({});

        await expect(
            findSentTransaction(getTransactions, isSent, options)
        ).resolves.toBeUndefined();
    });

    it('waits between attempts', async () => {
        jest.useFakeTimers();
        try {
            const getTransactions = jest
                .fn()
                .mockResolvedValue({ transactions: [] });
            const result = findSentTransaction(getTransactions, isSent, {
                attempts: 2,
                delayMs: 5000
            });

            await jest.advanceTimersByTimeAsync(0);
            expect(getTransactions).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(4999);
            expect(getTransactions).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(1);
            expect(getTransactions).toHaveBeenCalledTimes(2);
            await expect(result).resolves.toBeUndefined();
        } finally {
            jest.useRealTimers();
        }
    });
});
