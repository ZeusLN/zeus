import BigNumber from 'bignumber.js';

jest.mock('react-native', () => ({
    Platform: { OS: 'ios' }
}));

// Paths must mirror the real constants' asymmetry: the legacy Android writer
// used the PUBLIC Downloads dir (RNFS.DownloadDirectoryPath), not the
// app-scoped one, so the purge must read the same constant.
jest.mock('react-native-fs', () => ({
    DownloadDirectoryPath: '/public-downloads',
    DocumentDirectoryPath: '/docs',
    CachesDirectoryPath: '/cache',
    exists: jest.fn().mockResolvedValue(false),
    unlink: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined)
}));

const mockSaveDocuments = jest.fn();
jest.mock('@react-native-documents/picker', () => ({
    saveDocuments: (...args: any[]) => mockSaveDocuments(...args)
}));

import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import {
    bigCeil,
    bigFloor,
    calculateReceiveAmount,
    calculateServiceFeeOnSend,
    calculateSendAmount,
    calculateLimit,
    isValidRescueKey,
    swapWebSocketUrl,
    verifyReverseSwapInvoice,
    purgeLegacyRescueKeyFiles,
    saveRescueKeyFile,
    unlinkRescueKeyStagingFile,
    RESCUE_KEY_FILENAME
} from './SwapUtils';

// regtest BOLT11 vector: 123 sats,
// payment_hash f2cbe057ae04a29a28b098de1eea199d8f1802810fb4f0269dac84c6f8c8762d
const REVERSE_INVOICE =
    'lnbcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';
const REVERSE_INVOICE_HASH =
    'f2cbe057ae04a29a28b098de1eea199d8f1802810fb4f0269dac84c6f8c8762d';
const REVERSE_INVOICE_SATS = 123;

describe('SwapUtils', () => {
    describe('bigCeil', () => {
        it('should round up to the nearest integer', () => {
            expect(bigCeil(new BigNumber('1.01')).toString()).toBe('2');
            expect(bigCeil(new BigNumber('3.999')).toString()).toBe('4');
            expect(bigCeil(new BigNumber('5')).toString()).toBe('5');
        });
    });

    describe('bigFloor', () => {
        it('should round down to the nearest integer', () => {
            expect(bigFloor(new BigNumber('1.99')).toString()).toBe('1');
            expect(bigFloor(new BigNumber('3.0001')).toString()).toBe('3');
            expect(bigFloor(new BigNumber('5')).toString()).toBe('5');
        });
    });

    describe('calculateReceiveAmount', () => {
        it('should calculate receive amount correctly in normal mode', () => {
            const result = calculateReceiveAmount(
                new BigNumber('1000'),
                1,
                50,
                false
            );
            expect(result.toString()).toBe('940'); // 1000 - 50 = 950 / 1.01 ≈ 940.59 → floor = 940
        });

        it('should calculate receive amount correctly in reverse mode', () => {
            const result = calculateReceiveAmount(
                new BigNumber('1000'),
                1,
                50,
                true
            );
            expect(result.toString()).toBe('940'); // ceil(1% of 1000) = 10 → 1000 - 10 - 50 = 940
        });
    });

    describe('calculateServiceFeeOnSend', () => {
        it('should return 0 for invalid send amounts', () => {
            expect(
                calculateServiceFeeOnSend(
                    new BigNumber('0'),
                    1,
                    50,
                    false
                ).toString()
            ).toBe('0');
            expect(
                calculateServiceFeeOnSend(
                    new BigNumber('-10'),
                    1,
                    50,
                    true
                ).toString()
            ).toBe('0');
        });

        it('should calculate service fee in reverse mode', () => {
            const result = calculateServiceFeeOnSend(
                new BigNumber('1000'),
                1,
                50,
                true
            );
            expect(result.toString()).toBe('10'); // 1% of 1000 = 10 → ceil = 10
        });

        it('should calculate service fee in non-reverse mode', () => {
            const result = calculateServiceFeeOnSend(
                new BigNumber('1000'),
                1,
                50,
                false
            );
            expect(result.toString()).toBe('10'); // Receive amount ≈ 940, minerFee = 50 → 1000 - 940 - 50 = 10
        });
    });

    describe('calculateSendAmount', () => {
        it('should calculate send amount in reverse mode', () => {
            const result = calculateSendAmount(
                new BigNumber('940'),
                1,
                50,
                true
            );
            expect(result.toString()).toBe('1000'); // (940 + 50) / 0.99 = 1000 → ceil = 1000
        });

        it('should calculate send amount in normal mode', () => {
            const result = calculateSendAmount(
                new BigNumber('940'),
                1,
                50,
                false
            );
            expect(result.toString()).toBe('1000'); // 940 + 9.4 (ceil=10) + 50 = 1000 → ceil = 1000
        });
    });

    describe('calculateLimit', () => {
        it('should return calculated send amount when not in reverse mode', () => {
            const result = calculateLimit(940, 1, 50, false);
            expect(result).toBe(1000);
        });

        it('should return limit as-is when in reverse mode', () => {
            const result = calculateLimit(940, 1, 50, true);
            expect(result).toBe(940);
        });
    });

    describe('isValidRescueKey', () => {
        // BIP39 reference vector (128-bit entropy of all zeroes)
        const validMnemonic =
            'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

        it('should accept a valid 12-word mnemonic', () => {
            expect(isValidRescueKey(validMnemonic)).toBe(true);
            expect(
                isValidRescueKey(
                    'legal winner thank year wave sausage worth useful legal winner thank yellow'
                )
            ).toBe(true);
        });

        it('should tolerate surrounding and irregular whitespace', () => {
            expect(
                isValidRescueKey(`  ${validMnemonic.replace(/ /g, '   ')}  `)
            ).toBe(true);
        });

        it('should reject 12 wordlist words with a bad checksum', () => {
            // all-abandon fails the checksum (valid vector ends in 'about')
            expect(isValidRescueKey('abandon '.repeat(12).trim())).toBe(false);
        });

        it('should reject a single-word typo to another valid word', () => {
            expect(
                isValidRescueKey(validMnemonic.replace(/about$/, 'zoo'))
            ).toBe(false);
        });

        it('should reject a word-order transposition', () => {
            expect(
                isValidRescueKey(
                    'about abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon'
                )
            ).toBe(false);
        });

        it('should reject words outside the BIP39 wordlist', () => {
            expect(
                isValidRescueKey(validMnemonic.replace(/about$/, 'notaword'))
            ).toBe(false);
        });

        it('should reject wrong word counts, including valid 24-word seeds', () => {
            expect(isValidRescueKey('')).toBe(false);
            expect(
                isValidRescueKey(
                    validMnemonic.split(' ').slice(0, 11).join(' ')
                )
            ).toBe(false);
            // valid BIP39 mnemonic, but rescue keys must be exactly 12 words
            expect(
                isValidRescueKey(
                    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art'
                )
            ).toBe(false);
        });
    });

    describe('verifyReverseSwapInvoice', () => {
        it('accepts an invoice whose hash and amount match', () => {
            const result = verifyReverseSwapInvoice(
                REVERSE_INVOICE,
                REVERSE_INVOICE_HASH,
                REVERSE_INVOICE_SATS
            );
            expect(result.valid).toBe(true);
        });

        it('accepts a hash regardless of casing', () => {
            const result = verifyReverseSwapInvoice(
                REVERSE_INVOICE,
                REVERSE_INVOICE_HASH.toUpperCase(),
                REVERSE_INVOICE_SATS
            );
            expect(result.valid).toBe(true);
        });

        it('rejects a payment-hash mismatch (malicious host)', () => {
            const result = verifyReverseSwapInvoice(
                REVERSE_INVOICE,
                'f'.repeat(64),
                REVERSE_INVOICE_SATS
            );
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('payment-hash-mismatch');
        });

        it('rejects an amount mismatch even when the hash matches', () => {
            const result = verifyReverseSwapInvoice(
                REVERSE_INVOICE,
                REVERSE_INVOICE_HASH,
                REVERSE_INVOICE_SATS + 1
            );
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('amount-mismatch');
        });

        it('rejects an undecodable invoice', () => {
            const result = verifyReverseSwapInvoice(
                'not-a-real-invoice',
                REVERSE_INVOICE_HASH,
                REVERSE_INVOICE_SATS
            );
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('undecodable');
        });
    });

    describe('swapWebSocketUrl', () => {
        it('rewrites the scheme and appends the ws route', () => {
            expect(swapWebSocketUrl('https://api.boltz.exchange/v2')).toBe(
                'wss://api.boltz.exchange/v2/ws'
            );
            expect(swapWebSocketUrl('http://192.168.1.5:9001/v2')).toBe(
                'ws://192.168.1.5:9001/v2/ws'
            );
        });

        it('leaves a host containing "http" in its name intact', () => {
            expect(swapWebSocketUrl('https://boltz.httprelay.io/v2')).toBe(
                'wss://boltz.httprelay.io/v2/ws'
            );
        });

        it('leaves an http host containing "https" in its name intact', () => {
            // the unanchored replace hit "myhttpserver", not the scheme,
            // pointing swap updates at a host the user never configured
            expect(swapWebSocketUrl('http://myhttpserver.local:9001/v2')).toBe(
                'ws://myhttpserver.local:9001/v2/ws'
            );
        });

        it('rewrites only the scheme, never a later occurrence', () => {
            expect(swapWebSocketUrl('https://http.http/https')).toBe(
                'wss://http.http/https/ws'
            );
        });
    });

    describe('purgeLegacyRescueKeyFiles', () => {
        const exists = RNFS.exists as jest.Mock;
        const unlink = RNFS.unlink as jest.Mock;

        beforeEach(() => {
            Platform.OS = 'ios';
            exists.mockReset().mockResolvedValue(false);
            unlink.mockReset().mockResolvedValue(undefined);
        });

        it('does nothing when no legacy file exists', async () => {
            await purgeLegacyRescueKeyFiles();
            expect(exists).toHaveBeenCalledWith(`/docs/${RESCUE_KEY_FILENAME}`);
            expect(unlink).not.toHaveBeenCalled();
        });

        it('unlinks the legacy iOS Documents file when present', async () => {
            exists.mockResolvedValue(true);
            await purgeLegacyRescueKeyFiles();
            expect(unlink).toHaveBeenCalledWith(`/docs/${RESCUE_KEY_FILENAME}`);
        });

        it('unlinks from public Downloads on Android, matching the legacy writer', async () => {
            Platform.OS = 'android';
            exists.mockResolvedValue(true);
            await purgeLegacyRescueKeyFiles();
            expect(exists).toHaveBeenCalledWith(
                `/public-downloads/${RESCUE_KEY_FILENAME}`
            );
            expect(unlink).toHaveBeenCalledWith(
                `/public-downloads/${RESCUE_KEY_FILENAME}`
            );
        });

        it('swallows unlink errors (scoped storage may deny deletion)', async () => {
            exists.mockResolvedValue(true);
            unlink.mockRejectedValue(new Error('EACCES'));
            await expect(purgeLegacyRescueKeyFiles()).resolves.toBeUndefined();
        });
    });

    describe('unlinkRescueKeyStagingFile', () => {
        const exists = RNFS.exists as jest.Mock;
        const unlink = RNFS.unlink as jest.Mock;

        beforeEach(() => {
            exists.mockReset().mockResolvedValue(false);
            unlink.mockReset().mockResolvedValue(undefined);
        });

        it('does nothing when no staging file exists', async () => {
            await unlinkRescueKeyStagingFile();
            expect(exists).toHaveBeenCalledWith(
                `/cache/${RESCUE_KEY_FILENAME}`
            );
            expect(unlink).not.toHaveBeenCalled();
        });

        it('unlinks the staging file when present', async () => {
            exists.mockResolvedValue(true);
            await unlinkRescueKeyStagingFile();
            expect(unlink).toHaveBeenCalledWith(
                `/cache/${RESCUE_KEY_FILENAME}`
            );
        });

        it('swallows unlink errors', async () => {
            exists.mockResolvedValue(true);
            unlink.mockRejectedValue(new Error('EBUSY'));
            await expect(unlinkRescueKeyStagingFile()).resolves.toBeUndefined();
        });
    });

    describe('saveRescueKeyFile', () => {
        const exists = RNFS.exists as jest.Mock;
        const unlink = RNFS.unlink as jest.Mock;
        const writeFile = RNFS.writeFile as jest.Mock;
        const stagingPath = `/cache/${RESCUE_KEY_FILENAME}`;
        const mnemonic = 'abandon ability able about above absent';

        beforeEach(() => {
            exists.mockReset().mockResolvedValue(false);
            unlink.mockReset().mockResolvedValue(undefined);
            writeFile.mockReset().mockResolvedValue(undefined);
            mockSaveDocuments
                .mockReset()
                .mockResolvedValue([
                    { uri: 'content://saved', name: null, error: null }
                ]);
        });

        it('stages the mnemonic JSON and presents the system save dialog', async () => {
            await saveRescueKeyFile(mnemonic);

            expect(writeFile).toHaveBeenCalledWith(
                stagingPath,
                JSON.stringify({ mnemonic }, null, 2),
                'utf8'
            );
            expect(mockSaveDocuments).toHaveBeenCalledWith({
                sourceUris: [`file://${stagingPath}`],
                fileName: RESCUE_KEY_FILENAME,
                mimeType: 'application/json',
                copy: true
            });
        });

        it('removes the staging file after a successful save', async () => {
            // The staging file exists once written; the finally-unlink must
            // see and delete it.
            writeFile.mockImplementation(async () => {
                exists.mockResolvedValue(true);
            });

            await saveRescueKeyFile(mnemonic);

            expect(unlink).toHaveBeenCalledWith(stagingPath);
        });

        it('removes the staging file and rethrows when the user cancels the dialog', async () => {
            writeFile.mockImplementation(async () => {
                exists.mockResolvedValue(true);
            });
            mockSaveDocuments.mockRejectedValue(
                Object.assign(new Error('user canceled'), {
                    code: 'OPERATION_CANCELED'
                })
            );

            await expect(saveRescueKeyFile(mnemonic)).rejects.toMatchObject({
                code: 'OPERATION_CANCELED'
            });
            expect(unlink).toHaveBeenCalledWith(stagingPath);
        });

        it('throws when the save dialog reports a write error', async () => {
            mockSaveDocuments.mockResolvedValue([
                { uri: 'content://saved', name: null, error: 'write failed' }
            ]);

            await expect(saveRescueKeyFile(mnemonic)).rejects.toThrow(
                'write failed'
            );
        });
    });
});
