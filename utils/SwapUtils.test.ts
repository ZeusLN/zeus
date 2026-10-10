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
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';
import { address as bitcoinAddress, crypto, payments } from 'bitcoinjs-lib';
import {
    bigCeil,
    bigFloor,
    calculateReceiveAmount,
    calculateServiceFeeOnSend,
    calculateSendAmount,
    calculateLimit,
    fetchBlockHeight,
    isValidRescueKey,
    refundFailureAction,
    nativeSwapEndpoint,
    swapWebSocketUrl,
    verifyReverseSwapInvoice,
    purgeLegacyRescueKeyFiles,
    saveRescueKeyFile,
    unlinkRescueKeyStagingFile,
    RESCUE_KEY_FILENAME,
    deriveSwapPreimage,
    aggregateMusigKeys,
    rescuedLockupFloor,
    buildReverseSwapLeaves,
    deriveReverseSwapOutputKey,
    verifyReverseSwapResponse,
    checkLockupOutput
} from './SwapUtils';
import ecc from '@bitcoinerlab/secp256k1';

// regtest BOLT11 vector: 123 sats,
// payment_hash f2cbe057ae04a29a28b098de1eea199d8f1802810fb4f0269dac84c6f8c8762d
const REVERSE_INVOICE =
    'lnbcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';
const REVERSE_INVOICE_HASH =
    'f2cbe057ae04a29a28b098de1eea199d8f1802810fb4f0269dac84c6f8c8762d';
const REVERSE_INVOICE_SATS = 123;

// BIP39 canonical test mnemonic, used as a swap rescue key
const RESCUE_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

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

    describe('refundFailureAction', () => {
        const NOT_COSIGNED =
            'could not create refund transaction: all outputs invalid';
        const action = (
            cooperative: boolean,
            errorMessage: string,
            currentBlockHeight: number,
            timeoutBlockHeight = 900_000
        ) =>
            refundFailureAction({
                cooperative,
                errorMessage,
                currentBlockHeight,
                timeoutBlockHeight
            });

        it('retries uncooperatively once the timeout block is reached', () => {
            expect(action(true, NOT_COSIGNED, 900_000)).toEqual({
                type: 'retry-uncooperative'
            });
            expect(action(true, NOT_COSIGNED, 900_010)).toEqual({
                type: 'retry-uncooperative'
            });
        });

        it('says how long to wait when the host did not co-sign before the timeout', () => {
            expect(action(true, NOT_COSIGNED, 899_958)).toEqual({
                type: 'wait-for-timeout',
                blocksRemaining: 42
            });
        });

        it('says to wait without a count when the tip is unknown', () => {
            expect(action(true, NOT_COSIGNED, 0)).toEqual({
                type: 'wait-for-timeout'
            });
        });

        it('shows other cooperative errors as-is, even past the timeout', () => {
            const broadcast =
                'non-200 response: 400, body: min relay fee not met';
            expect(action(true, broadcast, 900_010)).toEqual({
                type: 'show-error'
            });
            expect(action(true, broadcast, 899_000)).toEqual({
                type: 'show-error'
            });
            expect(action(true, '', 900_010)).toEqual({ type: 'show-error' });
        });

        // mempool.space relays bitcoind's rejection in the response body
        const NON_FINAL =
            'non-200 response: 400, body: sendrawtransaction RPC error: {"code":-26,"message":"non-final"}';

        it('says how long to wait when an uncooperative refund is rejected as non-final', () => {
            expect(action(false, NON_FINAL, 899_999)).toEqual({
                type: 'wait-for-timeout',
                blocksRemaining: 1
            });
        });

        it('says to wait without a count when a non-final rejection has no usable tip', () => {
            expect(action(false, NON_FINAL, 0)).toEqual({
                type: 'wait-for-timeout'
            });
            // the node is past the timeout but the broadcaster is not yet
            expect(action(false, NON_FINAL, 900_000)).toEqual({
                type: 'wait-for-timeout'
            });
        });

        it('shows other uncooperative errors as-is, even before the timeout', () => {
            const fee = 'non-200 response: 400, body: min relay fee not met';
            const address =
                'could not create refund transaction: invalid address';
            expect(action(false, fee, 899_000)).toEqual({ type: 'show-error' });
            expect(action(false, address, 899_000)).toEqual({
                type: 'show-error'
            });
            expect(action(false, fee, 0)).toEqual({ type: 'show-error' });
            expect(action(false, '', 899_000)).toEqual({ type: 'show-error' });
        });

        it('shows the error when the swap has no timeout block', () => {
            expect(action(true, NOT_COSIGNED, 900_000, 0)).toEqual({
                type: 'show-error'
            });
            expect(action(true, NOT_COSIGNED, 900_000, NaN)).toEqual({
                type: 'show-error'
            });
        });
    });

    describe('fetchBlockHeight', () => {
        it('returns the fetched tip', async () => {
            expect(await fetchBlockHeight(async () => 900_123)).toBe(900_123);
        });

        it('returns 0 (unknown) when the fetch fails', async () => {
            const log = jest.spyOn(console, 'log').mockImplementation();
            expect(
                await fetchBlockHeight(() =>
                    Promise.reject(new Error('offline'))
                )
            ).toBe(0);
            log.mockRestore();
        });

        it('returns 0 (unknown) when the backend reports no height', async () => {
            expect(await fetchBlockHeight(async () => undefined)).toBe(0);
            expect(await fetchBlockHeight(async () => 0)).toBe(0);
        });
    });

    describe('nativeSwapEndpoint', () => {
        it.each([
            ['https://satsrouting.exchange/v2', 'https://satsrouting.exchange'],
            ['https://swap.coinos.io/v2', 'https://swap.coinos.io'],
            [
                'https://api.testnet.boltz.exchange/v2',
                'https://api.testnet.boltz.exchange'
            ],
            [
                'https://swaps.zeuslsp.com/api/v2',
                'https://swaps.zeuslsp.com/api'
            ]
        ])('strips /v2 from the default host %s', (endpoint, expected) => {
            expect(nativeSwapEndpoint(endpoint)).toBe(expected);
        });

        it('leaves a custom host without /v2 unchanged', () => {
            expect(nativeSwapEndpoint('http://192.168.1.5:9001')).toBe(
                'http://192.168.1.5:9001'
            );
        });

        it('handles a trailing slash', () => {
            expect(nativeSwapEndpoint('http://192.168.1.5:9001/v2/')).toBe(
                'http://192.168.1.5:9001'
            );
            expect(nativeSwapEndpoint('http://192.168.1.5:9001/')).toBe(
                'http://192.168.1.5:9001'
            );
        });

        it('keeps a /v2 that is not at the end', () => {
            // replace('/v2', '') removed the first match anywhere, here
            // breaking the host itself
            expect(nativeSwapEndpoint('https://v2.swaps.example/v2')).toBe(
                'https://v2.swaps.example'
            );
            expect(nativeSwapEndpoint('https://swaps.example/v2/api')).toBe(
                'https://swaps.example/v2/api'
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

    describe('deriveSwapPreimage', () => {
        // Pins the derivation so the creation path and the rescue path can
        // never drift apart: a swap created under one derivation and
        // rescued under another produces an unspendable claim, which the
        // host settles in its own favour at timeout.
        //
        // Vectors: BIP39 canonical mnemonic -> m/44/0/0/0/<index> ->
        // sha256(childPrivKey).
        const derivedPreimage = (index: number): Buffer => {
            const hdKey = HDKey.fromMasterSeed(
                mnemonicToSeedSync(RESCUE_MNEMONIC)
            );
            const childKey = hdKey.derive(`m/44/0/0/0/${index}`);
            return deriveSwapPreimage(childKey.privateKey!);
        };

        it('derives the pinned preimage for a known rescue key and index', () => {
            expect(derivedPreimage(0).toString('hex')).toBe(
                '03c0b3323daab895d806870bd1f050bdca624a24882d3e317b151d537fa75bb7'
            );
            expect(derivedPreimage(7).toString('hex')).toBe(
                '6f2731a6d8db87dfc8cc6d0b2371ae4e2009017016523b7871701a9d51aaae27'
            );
        });

        it('derives the payment hash the host committed to at creation', () => {
            // What ZEUS sends as preimageHash when creating the swap, and
            // therefore what the rescued claim has to be able to reproduce.
            expect(crypto.sha256(derivedPreimage(0)).toString('hex')).toBe(
                '5230e9679c6a67a8ea551827a8072a29d1850b5c26b92f3e1d61602f67314502'
            );
        });

        it('is deterministic and index-scoped', () => {
            expect(derivedPreimage(0).equals(derivedPreimage(0))).toBe(true);
            expect(derivedPreimage(0).equals(derivedPreimage(1))).toBe(false);
        });

        it('accepts a Uint8Array private key as bip32 returns it', () => {
            const privateKey = Uint8Array.from(Array(32).fill(1));
            expect(deriveSwapPreimage(privateKey)).toEqual(
                crypto.sha256(Buffer.from(privateKey))
            );
        });
    });

    // boltz-client v2.9.0 pkg/boltz/swaptree_test.go, BTC reverse swap
    describe('rescuedLockupFloor', () => {
        it.each([
            [100000, 90000],
            [25000, 22500],
            [10000, 9000],
            // 90% of 33333 is 29999.7, rounded up
            [33333, 30000],
            [1, 1]
        ])('claims %s sats paid without asking from %s sats', (paid, floor) => {
            expect(rescuedLockupFloor(paid)).toBe(floor);
        });
    });

    describe('reverse swap lockup verification', () => {
        const hex = (value: string) => Buffer.from(value, 'hex');
        const pubFromPriv = (priv: string) =>
            Buffer.from(ecc.pointFromScalar(hex(priv), true)!);

        const OUR_PUBKEY = pubFromPriv(
            '7886fd6464350f85c941bd80c824b1ad4f776b0aa1b4783a300b987d69966086'
        );
        const SERVER_PUBKEY =
            '0328baf0584489b39d218d0a59bbee01e93be6fba696b348a4033045f3cdc7dc37';
        const PREIMAGE_HASH = hex(
            'a1164fdb247b47931ed41fa1bd53391205406aa723adf4fda10b9ed013001016'
        );
        const TIMEOUT = 827793;
        const CLAIM_LEAF =
            '82012088a914fedcea7dea7e4c7923984fab9c0b409a4ea7f38a882017ccb3202dd3a3ad29f4bc046f2b51904ece962a6e5b05da73f5eb5eeb99b1b3ac';
        const REFUND_LEAF =
            '2028baf0584489b39d218d0a59bbee01e93be6fba696b348a4033045f3cdc7dc37ad0391a10cb1';
        const LOCKUP_ADDRESS =
            'bc1prmxmvl5z79ddhesfzu3ya0f8ck9k3tfvdcrxfzc8t9s7stm4nfrsyc9hzw';
        // a valid taproot address for a different swap (the submarine
        // vector from the same boltz-client test)
        const OTHER_TAPROOT_ADDRESS =
            'bc1px6up6cxg2vhf049x9g0v8wcztc0vvvd25zjqt6qf3streqvuzm7qm0dpkp';
        const OTHER_PUBKEY = pubFromPriv('01'.repeat(32));

        const response = (overrides: any = {}) => ({
            swapTree: {
                claimLeaf: { version: 192, output: CLAIM_LEAF },
                refundLeaf: { version: 192, output: REFUND_LEAF }
            },
            lockupAddress: LOCKUP_ADDRESS,
            serverPubKey: SERVER_PUBKEY,
            timeoutBlockHeight: TIMEOUT,
            onchainAmount: 100000,
            ourPubKey: OUR_PUBKEY,
            preimageHash: PREIMAGE_HASH,
            ...overrides
        });

        describe('aggregateMusigKeys', () => {
            // BIP 327 key_agg_vectors.json
            const X = [
                '02F9308A019258C31049344F85F89D5229B531C845836F99B08601F113BCE036F9',
                '03DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659',
                '023590A94E768F8E1815C2F24B4D80A8E3149316C3518CE7B7AD338368D038CA66'
            ].map(hex);

            it.each([
                [
                    [0, 1, 2],
                    '90539EEDE565F5D054F32CC0C220126889ED1E5D193BAF15AEF344FE59D4610C'
                ],
                [
                    [2, 1, 0],
                    '6204DE8B083426DC6EAF9502D27024D53FC826BF7D2012148A0575435DF54B2B'
                ],
                [
                    [0, 0, 0],
                    'B436E3BAD62B8CD409969A224731C193D051162D8C5AE8B109306127DA3AA935'
                ],
                [
                    [0, 0, 1, 1],
                    '69BC22BFA5D106306E48A20679DE1D7389386124D07571D0D872686028C26A3E'
                ]
            ])('matches BIP 327 vector for keys %j', (indices, expected) => {
                expect(
                    aggregateMusigKeys(indices.map((i) => X[i]))
                        .toString('hex')
                        .toUpperCase()
                ).toBe(expected);
            });
        });

        it('rebuilds the boltz-client reverse swap leaves byte for byte', () => {
            const { claimLeaf, refundLeaf } = buildReverseSwapLeaves({
                claimPubKey: OUR_PUBKEY,
                refundPubKey: hex(SERVER_PUBKEY),
                preimageHash: PREIMAGE_HASH,
                timeoutBlockHeight: TIMEOUT
            });
            expect(claimLeaf.toString('hex')).toBe(CLAIM_LEAF);
            expect(refundLeaf.toString('hex')).toBe(REFUND_LEAF);
        });

        // In the app, the buffer polyfill's subarray returns a plain
        // Uint8Array, so the x-only key reached script.compile as one and
        // was compiled as OP_0. Plain Uint8Array keys reproduce that here.
        it('rebuilds the same leaves from plain Uint8Array keys', () => {
            const { claimLeaf, refundLeaf } = buildReverseSwapLeaves({
                claimPubKey: Uint8Array.from(OUR_PUBKEY) as Buffer,
                refundPubKey: Uint8Array.from(hex(SERVER_PUBKEY)) as Buffer,
                preimageHash: PREIMAGE_HASH,
                timeoutBlockHeight: TIMEOUT
            });
            expect(claimLeaf.toString('hex')).toBe(CLAIM_LEAF);
            expect(refundLeaf.toString('hex')).toBe(REFUND_LEAF);
        });

        it('derives the boltz-client reverse swap lockup address', () => {
            const outputKey = deriveReverseSwapOutputKey({
                ourPubKey: OUR_PUBKEY,
                serverPubKey: hex(SERVER_PUBKEY),
                claimLeaf: hex(CLAIM_LEAF),
                refundLeaf: hex(REFUND_LEAF)
            });
            const check = verifyReverseSwapResponse(response());
            expect(check.valid).toBe(true);
            expect(check.valid && check.outputScript.toString('hex')).toBe(
                `5120${outputKey.toString('hex')}`
            );
        });

        describe('verifyReverseSwapResponse', () => {
            const otherClaimLeaf = (
                claimPubKey: Buffer,
                preimageHash: Buffer
            ) =>
                buildReverseSwapLeaves({
                    claimPubKey,
                    refundPubKey: hex(SERVER_PUBKEY),
                    preimageHash,
                    timeoutBlockHeight: TIMEOUT
                }).claimLeaf.toString('hex');

            it('accepts the vector with an on-chain amount above the minimum', () => {
                expect(
                    verifyReverseSwapResponse(
                        response({ minOnchainAmount: 99000 })
                    ).valid
                ).toBe(true);
            });

            it.each([
                [
                    'the lockup address is another taproot address',
                    { lockupAddress: OTHER_TAPROOT_ADDRESS },
                    'lockup-address-mismatch'
                ],
                [
                    'the lockup address is not taproot',
                    {
                        lockupAddress:
                            'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
                    },
                    'lockup-address-mismatch'
                ],
                [
                    'the lockup address is garbage',
                    { lockupAddress: 'not-an-address' },
                    'lockup-address-mismatch'
                ],
                [
                    'the claim leaf pays another key',
                    {
                        swapTree: {
                            claimLeaf: {
                                version: 192,
                                output: otherClaimLeaf(
                                    OTHER_PUBKEY,
                                    PREIMAGE_HASH
                                )
                            },
                            refundLeaf: { version: 192, output: REFUND_LEAF }
                        }
                    },
                    'claim-leaf-mismatch'
                ],
                [
                    'the claim leaf commits to another preimage hash',
                    {
                        swapTree: {
                            claimLeaf: {
                                version: 192,
                                output: otherClaimLeaf(
                                    OUR_PUBKEY,
                                    Buffer.alloc(32, 9)
                                )
                            },
                            refundLeaf: { version: 192, output: REFUND_LEAF }
                        }
                    },
                    'claim-leaf-mismatch'
                ],
                [
                    'the refund leaf has another timeout',
                    { timeoutBlockHeight: TIMEOUT + 1 },
                    'refund-leaf-mismatch'
                ],
                [
                    'a leaf has a non-tapscript version',
                    {
                        swapTree: {
                            claimLeaf: { version: 0xc4, output: CLAIM_LEAF },
                            refundLeaf: { version: 192, output: REFUND_LEAF }
                        }
                    },
                    'leaf-version'
                ],
                [
                    'the server key is not the one in the refund leaf',
                    {
                        serverPubKey: OTHER_PUBKEY.toString('hex'),
                        timeoutBlockHeight: undefined
                    },
                    'refund-leaf-mismatch'
                ],
                [
                    'the on-chain amount is not above the minimum',
                    { onchainAmount: 1000, minOnchainAmount: 99000 },
                    'onchain-amount-low'
                ],
                [
                    'the on-chain amount is missing but a minimum is set',
                    { onchainAmount: undefined, minOnchainAmount: 99000 },
                    'onchain-amount-low'
                ],
                [
                    'the swap tree is missing',
                    { swapTree: undefined },
                    'missing-fields'
                ],
                [
                    'the lockup address is missing',
                    { lockupAddress: undefined },
                    'missing-fields'
                ],
                [
                    'the server key is not a point',
                    { serverPubKey: 'ab' },
                    'missing-fields'
                ]
            ])('rejects when %s', (_, overrides, reason) => {
                expect(verifyReverseSwapResponse(response(overrides))).toEqual({
                    valid: false,
                    reason
                });
            });

            it('rejects an uncompressed server key whose lockup address matches the raw-bytes aggregate', () => {
                // The same point in 65-byte form. KeyAgg over those bytes
                // gives another output key than native boltz-client, which
                // aggregates compressed keys, so a host could fund this
                // address, take the preimage from the cooperative claim
                // request, and leave the claim unsignable.
                const uncompressed = Buffer.from(
                    ecc.pointCompress(hex(SERVER_PUBKEY), false)
                );
                expect(uncompressed).toHaveLength(65);
                const rawBytesKey = deriveReverseSwapOutputKey({
                    ourPubKey: OUR_PUBKEY,
                    serverPubKey: uncompressed,
                    claimLeaf: hex(CLAIM_LEAF),
                    refundLeaf: hex(REFUND_LEAF)
                });
                const nativeKey =
                    bitcoinAddress.fromBech32(LOCKUP_ADDRESS).data;
                expect(rawBytesKey.equals(Buffer.from(nativeKey))).toBe(false);

                expect(
                    verifyReverseSwapResponse(
                        response({
                            serverPubKey: uncompressed.toString('hex'),
                            lockupAddress: bitcoinAddress.toBech32(
                                rawBytesKey,
                                1,
                                'bc'
                            )
                        })
                    )
                ).toEqual({ valid: false, reason: 'server-key-encoding' });
            });

            it('rejects an uncompressed server key with the native lockup address', () => {
                expect(
                    verifyReverseSwapResponse(
                        response({
                            serverPubKey: Buffer.from(
                                ecc.pointCompress(hex(SERVER_PUBKEY), false)
                            ).toString('hex')
                        })
                    )
                ).toEqual({ valid: false, reason: 'server-key-encoding' });
            });

            it('accepts a rescued swap without a timeout or leaf versions', () => {
                expect(
                    verifyReverseSwapResponse(
                        response({
                            swapTree: {
                                claimLeaf: { output: CLAIM_LEAF },
                                refundLeaf: { output: REFUND_LEAF }
                            },
                            timeoutBlockHeight: undefined,
                            onchainAmount: undefined
                        })
                    ).valid
                ).toBe(true);
            });

            it('extracts the refund height from the reference script when metadata is absent', () => {
                expect(
                    verifyReverseSwapResponse(
                        response({ timeoutBlockHeight: undefined })
                    )
                ).toMatchObject({
                    valid: true,
                    timeoutBlockHeight: TIMEOUT
                });
            });

            it.each([0, -1, 500000000, 1700000000])(
                'rejects a rescued refund script with non-height CLTV %s',
                (height) => {
                    const { refundLeaf } = buildReverseSwapLeaves({
                        claimPubKey: OUR_PUBKEY,
                        refundPubKey: hex(SERVER_PUBKEY),
                        preimageHash: PREIMAGE_HASH,
                        timeoutBlockHeight: height
                    });
                    expect(
                        verifyReverseSwapResponse(
                            response({
                                timeoutBlockHeight: undefined,
                                swapTree: {
                                    claimLeaf: { output: CLAIM_LEAF },
                                    refundLeaf: {
                                        output: refundLeaf.toString('hex')
                                    }
                                }
                            })
                        )
                    ).toEqual({ valid: false, reason: 'refund-leaf-mismatch' });
                }
            );

            it.each([1, 16, 17, 499999999])(
                'decodes canonical refund height %s including small-integer opcodes',
                (height) => {
                    const { claimLeaf, refundLeaf } = buildReverseSwapLeaves({
                        claimPubKey: OUR_PUBKEY,
                        refundPubKey: hex(SERVER_PUBKEY),
                        preimageHash: PREIMAGE_HASH,
                        timeoutBlockHeight: height
                    });
                    const pubkey = deriveReverseSwapOutputKey({
                        ourPubKey: OUR_PUBKEY,
                        serverPubKey: hex(SERVER_PUBKEY),
                        claimLeaf,
                        refundLeaf
                    });
                    expect(
                        verifyReverseSwapResponse(
                            response({
                                timeoutBlockHeight: undefined,
                                lockupAddress: payments.p2tr({ pubkey })
                                    .address,
                                swapTree: {
                                    claimLeaf: {
                                        output: claimLeaf.toString('hex')
                                    },
                                    refundLeaf: {
                                        output: refundLeaf.toString('hex')
                                    }
                                }
                            })
                        )
                    ).toMatchObject({
                        valid: true,
                        timeoutBlockHeight: height
                    });
                }
            );

            it.each(['0491a10c00', '0691a10c000000', '4c0391a10c'])(
                'rejects nonminimal or oversized refund operands %s',
                (operand) => {
                    expect(
                        verifyReverseSwapResponse(
                            response({
                                timeoutBlockHeight: undefined,
                                swapTree: {
                                    claimLeaf: { output: CLAIM_LEAF },
                                    refundLeaf: {
                                        output: `20${SERVER_PUBKEY.slice(
                                            2
                                        )}ad${operand}b1`
                                    }
                                }
                            })
                        )
                    ).toEqual({ valid: false, reason: 'refund-leaf-mismatch' });
                }
            );
        });

        describe('checkLockupOutput', () => {
            const check = verifyReverseSwapResponse(response());
            const outputScript = check.valid
                ? check.outputScript
                : Buffer.alloc(0);
            const scriptHex = outputScript.toString('hex');
            const tx = (vout: any[], confirmed = true) => ({
                vout,
                status: { confirmed }
            });

            it.each([
                [
                    'a confirmed output for the exact amount',
                    tx([{ scriptpubkey: scriptHex, value: 100000 }]),
                    100000,
                    'ok'
                ],
                [
                    'a confirmed output above the amount',
                    tx([{ scriptpubkey: scriptHex, value: 100500 }]),
                    100000,
                    'ok'
                ],
                [
                    'an unconfirmed output',
                    tx([{ scriptpubkey: scriptHex, value: 100000 }], false),
                    100000,
                    'unconfirmed'
                ],
                [
                    'no output to the lockup script',
                    tx([
                        {
                            scriptpubkey: '0014' + '00'.repeat(20),
                            value: 100000
                        }
                    ]),
                    100000,
                    'missing-output'
                ],
                [
                    'an output far below the amount',
                    tx([{ scriptpubkey: scriptHex, value: 1000 }]),
                    100000,
                    'underfunded'
                ],
                [
                    'two outputs to the script, only the second funded (the claim spends the first)',
                    tx([
                        { scriptpubkey: scriptHex, value: 1000 },
                        { scriptpubkey: scriptHex, value: 100000 }
                    ]),
                    100000,
                    'underfunded'
                ],
                [
                    'two outputs to the script, the first funded',
                    tx([
                        { scriptpubkey: scriptHex, value: 100000 },
                        { scriptpubkey: scriptHex, value: 1000 }
                    ]),
                    100000,
                    'ok'
                ],
                [
                    'a v0 output with the same program ahead of ours (the claim would pick it)',
                    tx([
                        {
                            scriptpubkey: '0020' + scriptHex.slice(4),
                            value: 330
                        },
                        { scriptpubkey: scriptHex, value: 100000 }
                    ]),
                    100000,
                    'missing-output'
                ],
                [
                    'an uppercase script hex',
                    tx([
                        { scriptpubkey: scriptHex.toUpperCase(), value: 100000 }
                    ]),
                    100000,
                    'ok'
                ],
                [
                    'a rescued swap with no recorded amount',
                    tx([{ scriptpubkey: scriptHex, value: 1 }]),
                    undefined,
                    'ok'
                ],
                ['an empty response', {}, 100000, 'missing-output']
            ])(
                'returns the status for %s',
                (_, esploraTx, minAmount, expected) => {
                    expect(
                        checkLockupOutput(
                            esploraTx as any,
                            outputScript,
                            minAmount
                        )
                    ).toBe(expected);
                }
            );
        });
    });
});
