import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { schnorr } from '@noble/curves/secp256k1.js';
import { getEventHash, getPublicKey, nip19, nip44 } from 'nostr-tools';
import * as bip39 from '@scure/bip39';

import {
    backupMintsToNostr,
    deriveMintBackupKeypair,
    restoreMintsFromNostr
} from './NostrMintBackup';
import Base64Utils from './Base64Utils';

let mockRelayFactory: ((url: string) => any) | null = null;

jest.mock('nostr-tools', () => {
    const actual = jest.requireActual('nostr-tools');
    class MockRelay {
        constructor(url: string) {
            return mockRelayFactory
                ? mockRelayFactory(url)
                : new actual.Relay(url);
        }
        static async connect(url: string) {
            const relay = mockRelayFactory
                ? mockRelayFactory(url)
                : new actual.Relay(url);
            await relay.connect();
            return relay;
        }
    }
    return { ...actual, Relay: MockRelay };
});

interface RelayScript {
    events?: any[];
    neverRespond?: boolean;
    failConnect?: boolean;
}

function installFakeRelays(scripts: Record<string, RelayScript>) {
    const relays: Record<string, any> = {};
    mockRelayFactory = (url: string) => {
        const script = scripts[url] ?? {};
        const relay = {
            url,
            connect: () =>
                script.failConnect
                    ? Promise.reject(new Error('connect failed'))
                    : Promise.resolve(),
            subscribe: (_filters: any, params: any) => {
                const sub = { close: jest.fn() };
                if (!script.neverRespond) {
                    // Fires after the caller has taken the subscription
                    // handle, under both real and fake timers
                    queueMicrotask(() => {
                        for (const ev of script.events ?? []) {
                            params.onevent(ev);
                        }
                        params.oneose();
                    });
                }
                return sub;
            },
            publish: jest.fn(() => Promise.resolve()),
            close: jest.fn()
        };
        relays[url] = relay;
        return relay;
    };
    return relays;
}

function makeBackupEvent(
    signerPrivHex: string,
    conversationKey: Uint8Array,
    mints: string[],
    timestamp: number,
    opts: {
        tamperSig?: boolean;
        rawPayload?: string;
        plainContent?: string;
    } = {}
) {
    const plaintext =
        opts.rawPayload !== undefined
            ? opts.rawPayload
            : JSON.stringify({ mints, timestamp });
    const content =
        opts.plainContent !== undefined
            ? opts.plainContent
            : nip44.encrypt(plaintext, conversationKey);
    const signerPriv = hexToBytes(signerPrivHex);
    const unsigned = {
        kind: 30078,
        content,
        tags: [
            ['d', 'mint-list'],
            ['client', 'zeus']
        ],
        created_at: timestamp,
        pubkey: getPublicKey(signerPriv)
    };
    // Signed by hand rather than with finalizeEvent: finalizeEvent marks
    // the event as already verified, and verifyEvent trusts that marker,
    // which would make the signature assertions below vacuous
    const id = getEventHash(unsigned as any);
    const event: any = {
        ...unsigned,
        id,
        sig: bytesToHex(schnorr.sign(hexToBytes(id), signerPriv))
    };
    if (opts.tamperSig) {
        event.sig = (event.sig[0] === '0' ? '1' : '0') + event.sig.slice(1);
    }
    return event;
}

describe('NostrMintBackup', () => {
    // A fixed test mnemonic (DO NOT use in production)
    const testMnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const testSeed = bip39.mnemonicToSeedSync(testMnemonic);

    describe('deriveMintBackupKeypair', () => {
        it('should return privateKey, privateKeyHex, and publicKeyHex', () => {
            const result = deriveMintBackupKeypair(testSeed);

            expect(result.privateKey).toBeInstanceOf(Uint8Array);
            expect(result.privateKey.length).toBe(32);
            expect(result.privateKeyHex).toMatch(/^[0-9a-f]{64}$/);
            expect(result.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);
        });

        it('should be deterministic — same seed always produces same keys', () => {
            const result1 = deriveMintBackupKeypair(testSeed);
            const result2 = deriveMintBackupKeypair(testSeed);

            expect(result1.privateKeyHex).toBe(result2.privateKeyHex);
            expect(result1.publicKeyHex).toBe(result2.publicKeyHex);
        });

        it('should produce different keys for different seeds', () => {
            const otherMnemonic =
                'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
            const otherSeed = bip39.mnemonicToSeedSync(otherMnemonic);

            const result1 = deriveMintBackupKeypair(testSeed);
            const result2 = deriveMintBackupKeypair(otherSeed);

            expect(result1.privateKeyHex).not.toBe(result2.privateKeyHex);
            expect(result1.publicKeyHex).not.toBe(result2.publicKeyHex);
        });

        it('should produce a valid secp256k1 keypair', () => {
            const { privateKey, publicKeyHex } =
                deriveMintBackupKeypair(testSeed);

            // Verify the public key matches what nostr-tools derives
            const expectedPubkey = getPublicKey(privateKey);
            expect(publicKeyHex).toBe(expectedPubkey);
        });

        it('should produce valid npub/nsec encodings', () => {
            const { privateKey, privateKeyHex, publicKeyHex } =
                deriveMintBackupKeypair(testSeed);

            const npub = nip19.npubEncode(publicKeyHex);
            const nsec = nip19.nsecEncode(privateKey);

            expect(npub).toMatch(/^npub1/);
            expect(nsec).toMatch(/^nsec1/);

            // Roundtrip
            const decodedNpub = nip19.decode(npub);
            expect(decodedNpub.data).toBe(publicKeyHex);

            const decodedNsec = nip19.decode(nsec);
            expect(bytesToHex(decodedNsec.data as Uint8Array)).toBe(
                privateKeyHex
            );
        });
    });

    describe('cross-compatibility with cashu.me', () => {
        it('should use the same derivation as cashu.me: SHA-256(seed || "cashu-mint-backup")', () => {
            const { privateKeyHex } = deriveMintBackupKeypair(testSeed);

            // Manually replicate cashu.me's derivation
            const domainSeparator =
                Base64Utils.utf8ToBytes('cashu-mint-backup');
            const combined = new Uint8Array(
                testSeed.length + domainSeparator.length
            );
            combined.set(testSeed);
            combined.set(domainSeparator, testSeed.length);
            const expectedPrivateKey = bytesToHex(sha256(combined));

            expect(privateKeyHex).toBe(expectedPrivateKey);
        });

        it('should produce a stable keypair for the well-known test vector', () => {
            const { privateKeyHex, publicKeyHex } =
                deriveMintBackupKeypair(testSeed);

            // Derived from "abandon abandon ... about" mnemonic.
            // Must match cashu.me's output for the same seed.
            expect(privateKeyHex).toBe(
                'a2b87a529208651bbf974186ee4a0c13c1f31e07030de6ebd09ee33559ff97a7'
            );
            expect(publicKeyHex).toBe(
                'e1c971f6a291628471291a266ab85c6ffd7116c7aab6299a6801ae502f56d69b'
            );
        });
    });

    describe('restoreMintsFromNostr', () => {
        const { privateKey, privateKeyHex, publicKeyHex } =
            deriveMintBackupKeypair(testSeed);
        const conversationKey = nip44.getConversationKey(
            privateKey,
            publicKeyHex
        );

        afterEach(() => {
            mockRelayFactory = null;
            jest.useRealTimers();
        });

        it('returns the freshest backup across relays, not the first to answer', async () => {
            installFakeRelays({
                'wss://relay-a': {
                    events: [
                        makeBackupEvent(
                            privateKeyHex,
                            conversationKey,
                            ['https://old-mint'],
                            1000
                        )
                    ]
                },
                'wss://relay-b': {
                    events: [
                        makeBackupEvent(
                            privateKeyHex,
                            conversationKey,
                            ['https://new-mint'],
                            2000
                        )
                    ]
                }
            });

            const result = await restoreMintsFromNostr(
                privateKeyHex,
                publicKeyHex,
                ['wss://relay-a', 'wss://relay-b']
            );

            expect(result).toEqual({
                mints: ['https://new-mint'],
                timestamp: 2000
            });
        });

        it('lets a newer empty backup beat an older non-empty one', async () => {
            installFakeRelays({
                'wss://relay-a': {
                    events: [
                        makeBackupEvent(
                            privateKeyHex,
                            conversationKey,
                            ['https://old-mint'],
                            1000
                        )
                    ]
                },
                'wss://relay-b': {
                    events: [
                        makeBackupEvent(
                            privateKeyHex,
                            conversationKey,
                            [],
                            2000
                        )
                    ]
                }
            });

            const result = await restoreMintsFromNostr(
                privateKeyHex,
                publicKeyHex,
                ['wss://relay-a', 'wss://relay-b']
            );

            expect(result).toEqual({ mints: [], timestamp: 2000 });
        });

        it('drops backups older than minTimestamp', async () => {
            installFakeRelays({
                'wss://relay-a': {
                    events: [
                        makeBackupEvent(
                            privateKeyHex,
                            conversationKey,
                            ['https://old-mint'],
                            1000
                        )
                    ]
                }
            });

            const result = await restoreMintsFromNostr(
                privateKeyHex,
                publicKeyHex,
                ['wss://relay-a'],
                1500
            );

            expect(result).toBeNull();
        });

        it('accepts a backup whose timestamp equals minTimestamp', async () => {
            installFakeRelays({
                'wss://relay-a': {
                    events: [
                        makeBackupEvent(
                            privateKeyHex,
                            conversationKey,
                            ['https://mint'],
                            1000
                        )
                    ]
                }
            });

            const result = await restoreMintsFromNostr(
                privateKeyHex,
                publicKeyHex,
                ['wss://relay-a'],
                1000
            );

            expect(result).toEqual({
                mints: ['https://mint'],
                timestamp: 1000
            });
        });

        it('rejects events signed by a different pubkey', async () => {
            // Valid signature from another key, but content encrypted
            // with our conversation key — the pubkey check must fire
            // independently of decryptability
            const attackerPrivHex = bytesToHex(
                sha256(Base64Utils.utf8ToBytes('attacker'))
            );
            installFakeRelays({
                'wss://relay-a': {
                    events: [
                        makeBackupEvent(
                            attackerPrivHex,
                            conversationKey,
                            ['https://evil-mint'],
                            9999
                        )
                    ]
                }
            });

            const result = await restoreMintsFromNostr(
                privateKeyHex,
                publicKeyHex,
                ['wss://relay-a']
            );

            expect(result).toBeNull();
        });

        it('rejects events with a tampered signature', async () => {
            installFakeRelays({
                'wss://relay-a': {
                    events: [
                        makeBackupEvent(
                            privateKeyHex,
                            conversationKey,
                            ['https://mint'],
                            1000,
                            { tamperSig: true }
                        )
                    ]
                }
            });

            const result = await restoreMintsFromNostr(
                privateKeyHex,
                publicKeyHex,
                ['wss://relay-a']
            );

            expect(result).toBeNull();
        });

        it('rejects malformed backup payloads', async () => {
            installFakeRelays({
                'wss://relay-a': {
                    events: [
                        makeBackupEvent(privateKeyHex, conversationKey, [], 0, {
                            rawPayload: JSON.stringify({
                                mints: [1, 2],
                                timestamp: 1000
                            })
                        })
                    ]
                },
                'wss://relay-b': {
                    events: [
                        makeBackupEvent(privateKeyHex, conversationKey, [], 0, {
                            rawPayload: JSON.stringify({
                                mints: 'not-an-array',
                                timestamp: 1000
                            })
                        })
                    ]
                },
                'wss://relay-c': {
                    events: [
                        makeBackupEvent(privateKeyHex, conversationKey, [], 0, {
                            plainContent: 'not-nip44-ciphertext'
                        })
                    ]
                }
            });

            const result = await restoreMintsFromNostr(
                privateKeyHex,
                publicKeyHex,
                ['wss://relay-a', 'wss://relay-b', 'wss://relay-c']
            );

            expect(result).toBeNull();
        });

        it('times out a hung relay without losing other relays', async () => {
            jest.useFakeTimers();
            const relays = installFakeRelays({
                'wss://relay-a': { neverRespond: true },
                'wss://relay-b': {
                    events: [
                        makeBackupEvent(
                            privateKeyHex,
                            conversationKey,
                            ['https://mint'],
                            2000
                        )
                    ]
                }
            });

            const promise = restoreMintsFromNostr(privateKeyHex, publicKeyHex, [
                'wss://relay-a',
                'wss://relay-b'
            ]);
            await jest.advanceTimersByTimeAsync(10000);
            const result = await promise;

            expect(result).toEqual({
                mints: ['https://mint'],
                timestamp: 2000
            });
            expect(relays['wss://relay-a'].close).toHaveBeenCalled();
        });

        it('returns null when all relays fail or have no backup', async () => {
            installFakeRelays({
                'wss://relay-a': { failConnect: true },
                'wss://relay-b': { events: [] }
            });

            const result = await restoreMintsFromNostr(
                privateKeyHex,
                publicKeyHex,
                ['wss://relay-a', 'wss://relay-b']
            );

            expect(result).toBeNull();
        });
    });

    describe('backupMintsToNostr', () => {
        const { privateKey, privateKeyHex, publicKeyHex } =
            deriveMintBackupKeypair(testSeed);
        const conversationKey = nip44.getConversationKey(
            privateKey,
            publicKeyHex
        );

        afterEach(() => {
            mockRelayFactory = null;
        });

        it('publishes a valid signed event for an empty mint list', async () => {
            // Removing the last mint must propagate an empty backup,
            // otherwise the stale non-empty list stays latest forever
            const relays = installFakeRelays({ 'wss://relay-a': {} });

            const timestamp = await backupMintsToNostr(
                privateKeyHex,
                publicKeyHex,
                [],
                ['wss://relay-a']
            );

            const publishMock = relays['wss://relay-a'].publish;
            expect(publishMock).toHaveBeenCalledTimes(1);
            const event = publishMock.mock.calls[0][0];
            expect(event.pubkey).toBe(publicKeyHex);
            // Re-derive the id and check the schnorr signature directly:
            // verifyEvent would short-circuit on the marker finalizeEvent
            // leaves behind and assert nothing
            expect(getEventHash(event)).toBe(event.id);
            expect(
                schnorr.verify(
                    hexToBytes(event.sig),
                    hexToBytes(event.id),
                    hexToBytes(event.pubkey)
                )
            ).toBe(true);
            const decrypted = JSON.parse(
                nip44.decrypt(event.content, conversationKey)
            );
            expect(decrypted).toEqual({ mints: [], timestamp });
        });
    });
});
