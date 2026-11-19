const mockQueryProfile = jest.fn();
jest.mock('nostr-tools', () => ({
    ...jest.requireActual('nostr-tools'),
    nip05: {
        ...jest.requireActual('nostr-tools').nip05,
        queryProfile: (...args: any[]) => mockQueryProfile(...args)
    }
}));

const mockDoTorRequest = jest.fn();
jest.mock('./TorUtils', () => ({
    doTorRequest: (...args: any[]) => mockDoTorRequest(...args),
    RequestMethod: { GET: 'get' }
}));

import NostrUtils from './NostrUtils';

describe('NostrUtils', () => {
    // Valid npub (ZEUS official)
    const validNpub =
        'npub1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5';
    const validHex =
        '34d2f5274f1958fcd2cb2463dabeaddf8a21f84ace4241da888023bf05cc8095';

    describe('isValidNpub', () => {
        it('should return true for valid npub', () => {
            expect(NostrUtils.isValidNpub(validNpub)).toBe(true);
        });

        it('should return true for valid npub with whitespace', () => {
            expect(NostrUtils.isValidNpub(`  ${validNpub}  `)).toBe(true);
        });

        it('should return true for uppercase npub (case insensitive)', () => {
            expect(NostrUtils.isValidNpub(validNpub.toUpperCase())).toBe(true);
        });

        it('should return false for empty string', () => {
            expect(NostrUtils.isValidNpub('')).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(NostrUtils.isValidNpub(null as any)).toBe(false);
            expect(NostrUtils.isValidNpub(undefined as any)).toBe(false);
        });

        it('should return false for wrong prefix', () => {
            expect(
                NostrUtils.isValidNpub(
                    'nsec1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5'
                )
            ).toBe(false);
        });

        it('should return false for too short npub', () => {
            expect(NostrUtils.isValidNpub('npub1abc123')).toBe(false);
        });

        it('should return false for too long npub', () => {
            expect(NostrUtils.isValidNpub(validNpub + 'extra')).toBe(false);
        });

        it('should return false for invalid characters', () => {
            expect(
                NostrUtils.isValidNpub(
                    'npub1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpro'
                )
            ).toBe(false); // 'o' is not valid in bech32
        });

        it('should return false for invalid bech32 checksum', () => {
            // Change last character to break checksum
            const invalidChecksum = validNpub.slice(0, -1) + 'a';
            expect(NostrUtils.isValidNpub(invalidChecksum)).toBe(false);
        });

        it('should return false for hex pubkey', () => {
            expect(NostrUtils.isValidNpub(validHex)).toBe(false);
        });

        it('should return false for random string', () => {
            expect(NostrUtils.isValidNpub('hello world')).toBe(false);
        });
    });

    describe('npubToHex', () => {
        it('should decode valid npub to hex', () => {
            expect(NostrUtils.npubToHex(validNpub)).toBe(validHex);
        });

        it('should handle whitespace', () => {
            expect(NostrUtils.npubToHex(`  ${validNpub}  `)).toBe(validHex);
        });

        it('should return null for empty string', () => {
            expect(NostrUtils.npubToHex('')).toBe(null);
        });

        it('should return null for null/undefined', () => {
            expect(NostrUtils.npubToHex(null as any)).toBe(null);
            expect(NostrUtils.npubToHex(undefined as any)).toBe(null);
        });

        it('should return null for invalid npub', () => {
            expect(NostrUtils.npubToHex('npub1invalid')).toBe(null);
        });

        it('should return null for nsec (wrong type)', () => {
            // This is a valid nsec, not npub
            expect(
                NostrUtils.npubToHex(
                    'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5'
                )
            ).toBe(null);
        });
    });

    describe('hexToNpub', () => {
        it('should encode valid hex to npub', () => {
            expect(NostrUtils.hexToNpub(validHex)).toBe(validNpub);
        });

        it('should handle whitespace', () => {
            expect(NostrUtils.hexToNpub(`  ${validHex}  `)).toBe(validNpub);
        });

        it('should handle uppercase hex', () => {
            expect(NostrUtils.hexToNpub(validHex.toUpperCase())).toBe(
                validNpub
            );
        });

        it('should return null for empty string', () => {
            expect(NostrUtils.hexToNpub('')).toBe(null);
        });

        it('should return null for null/undefined', () => {
            expect(NostrUtils.hexToNpub(null as any)).toBe(null);
            expect(NostrUtils.hexToNpub(undefined as any)).toBe(null);
        });

        it('should return null for too short hex', () => {
            expect(NostrUtils.hexToNpub('abcd1234')).toBe(null);
        });

        it('should return null for too long hex', () => {
            expect(NostrUtils.hexToNpub(validHex + 'ff')).toBe(null);
        });

        it('should return null for invalid hex characters', () => {
            expect(
                NostrUtils.hexToNpub(
                    'ghij02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5'
                )
            ).toBe(null);
        });
    });

    describe('roundtrip', () => {
        it('should roundtrip npub -> hex -> npub', () => {
            const hex = NostrUtils.npubToHex(validNpub);
            expect(hex).not.toBe(null);
            const npub = NostrUtils.hexToNpub(hex!);
            expect(npub).toBe(validNpub);
        });

        it('should roundtrip hex -> npub -> hex', () => {
            const npub = NostrUtils.hexToNpub(validHex);
            expect(npub).not.toBe(null);
            const hex = NostrUtils.npubToHex(npub!);
            expect(hex).toBe(validHex);
        });
    });

    // Valid nsec for testing (randomly generated, not a real secret)
    const validNsec =
        'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
    const validNsecHex =
        '67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa';

    describe('isValidNsec', () => {
        it('should return true for valid nsec', () => {
            expect(NostrUtils.isValidNsec(validNsec)).toBe(true);
        });

        it('should return true for valid nsec with whitespace', () => {
            expect(NostrUtils.isValidNsec(`  ${validNsec}  `)).toBe(true);
        });

        it('should return true for uppercase nsec (case insensitive)', () => {
            expect(NostrUtils.isValidNsec(validNsec.toUpperCase())).toBe(true);
        });

        it('should return false for empty string', () => {
            expect(NostrUtils.isValidNsec('')).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(NostrUtils.isValidNsec(null as any)).toBe(false);
            expect(NostrUtils.isValidNsec(undefined as any)).toBe(false);
        });

        it('should return false for npub (wrong type)', () => {
            expect(NostrUtils.isValidNsec(validNpub)).toBe(false);
        });

        it('should return false for too short nsec', () => {
            expect(NostrUtils.isValidNsec('nsec1abc123')).toBe(false);
        });

        it('should return false for too long nsec', () => {
            expect(NostrUtils.isValidNsec(validNsec + 'extra')).toBe(false);
        });

        it('should return false for invalid bech32 checksum', () => {
            const invalidChecksum = validNsec.slice(0, -1) + 'a';
            expect(NostrUtils.isValidNsec(invalidChecksum)).toBe(false);
        });

        it('should return false for hex key', () => {
            expect(NostrUtils.isValidNsec(validNsecHex)).toBe(false);
        });
    });

    describe('nsecToHex', () => {
        it('should decode valid nsec to hex', () => {
            expect(NostrUtils.nsecToHex(validNsec)).toBe(validNsecHex);
        });

        it('should handle whitespace', () => {
            expect(NostrUtils.nsecToHex(`  ${validNsec}  `)).toBe(validNsecHex);
        });

        it('should return null for empty string', () => {
            expect(NostrUtils.nsecToHex('')).toBe(null);
        });

        it('should return null for null/undefined', () => {
            expect(NostrUtils.nsecToHex(null as any)).toBe(null);
            expect(NostrUtils.nsecToHex(undefined as any)).toBe(null);
        });

        it('should return null for invalid nsec', () => {
            expect(NostrUtils.nsecToHex('nsec1invalid')).toBe(null);
        });

        it('should return null for npub (wrong type)', () => {
            expect(NostrUtils.nsecToHex(validNpub)).toBe(null);
        });
    });

    describe('hexToNsec', () => {
        it('should encode valid hex to nsec', () => {
            expect(NostrUtils.hexToNsec(validNsecHex)).toBe(validNsec);
        });

        it('should handle whitespace', () => {
            expect(NostrUtils.hexToNsec(`  ${validNsecHex}  `)).toBe(validNsec);
        });

        it('should handle uppercase hex', () => {
            expect(NostrUtils.hexToNsec(validNsecHex.toUpperCase())).toBe(
                validNsec
            );
        });

        it('should return null for empty string', () => {
            expect(NostrUtils.hexToNsec('')).toBe(null);
        });

        it('should return null for null/undefined', () => {
            expect(NostrUtils.hexToNsec(null as any)).toBe(null);
            expect(NostrUtils.hexToNsec(undefined as any)).toBe(null);
        });

        it('should return null for too short hex', () => {
            expect(NostrUtils.hexToNsec('abcd1234')).toBe(null);
        });

        it('should return null for too long hex', () => {
            expect(NostrUtils.hexToNsec(validNsecHex + 'ff')).toBe(null);
        });

        it('should return null for invalid hex characters', () => {
            expect(
                NostrUtils.hexToNsec(
                    'ghij029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laq'
                )
            ).toBe(null);
        });
    });

    describe('nsec roundtrip', () => {
        it('should roundtrip nsec -> hex -> nsec', () => {
            const hex = NostrUtils.nsecToHex(validNsec);
            expect(hex).not.toBe(null);
            const nsec = NostrUtils.hexToNsec(hex!);
            expect(nsec).toBe(validNsec);
        });

        it('should roundtrip hex -> nsec -> hex', () => {
            const nsec = NostrUtils.hexToNsec(validNsecHex);
            expect(nsec).not.toBe(null);
            const hex = NostrUtils.nsecToHex(nsec!);
            expect(hex).toBe(validNsecHex);
        });
    });

    describe('queryNip05Profile', () => {
        beforeEach(() => {
            mockQueryProfile.mockReset();
        });

        it('lowercases the identifier before the lookup', async () => {
            mockQueryProfile.mockResolvedValue({ pubkey: validHex });

            const result = await NostrUtils.queryNip05Profile(
                'SATOSHI@Domain.COM'
            );

            expect(mockQueryProfile).toHaveBeenCalledWith('satoshi@domain.com');
            expect(result).toEqual({ pubkey: validHex });
        });

        it('returns null when the lookup finds nothing', async () => {
            mockQueryProfile.mockResolvedValue(null);

            await expect(
                NostrUtils.queryNip05Profile('satoshi@domain.com')
            ).resolves.toBe(null);
        });

        it('passes lookup errors through', async () => {
            mockQueryProfile.mockRejectedValue(new Error('network'));

            await expect(
                NostrUtils.queryNip05Profile('satoshi@domain.com')
            ).rejects.toThrow('network');
        });

        it('does not look up .onion identifiers', async () => {
            const onion =
                '2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion';

            for (const identifier of [
                `satoshi@${onion}`,
                `satoshi@${onion.toUpperCase()}`,
                `satoshi@${onion}.`,
                onion
            ]) {
                await expect(
                    NostrUtils.queryNip05Profile(identifier)
                ).resolves.toBe(null);
            }

            expect(mockQueryProfile).not.toHaveBeenCalled();
        });

        describe('with Tor enabled', () => {
            const mockFetch = jest.fn();
            const originalFetch = global.fetch;

            beforeEach(() => {
                mockDoTorRequest.mockReset();
                mockFetch.mockReset();
                global.fetch = mockFetch as any;
            });

            afterAll(() => {
                global.fetch = originalFetch;
            });

            it('sends the nostr.json request through Tor', async () => {
                mockDoTorRequest.mockResolvedValue({
                    names: { satoshi: validHex },
                    relays: { [validHex]: ['wss://relay.example.com'] }
                });

                const result = await NostrUtils.queryNip05Profile(
                    'SATOSHI@Domain.COM',
                    true
                );

                expect(mockDoTorRequest).toHaveBeenCalledWith(
                    'https://domain.com/.well-known/nostr.json?name=satoshi',
                    'get'
                );
                expect(mockFetch).not.toHaveBeenCalled();
                expect(mockQueryProfile).not.toHaveBeenCalled();
                expect(result).toEqual({
                    pubkey: validHex,
                    relays: ['wss://relay.example.com']
                });
            });

            it('looks up the root name for a bare domain', async () => {
                mockDoTorRequest.mockResolvedValue({
                    names: { _: validHex }
                });

                const result = await NostrUtils.queryNip05Profile(
                    'domain.com',
                    true
                );

                expect(mockDoTorRequest).toHaveBeenCalledWith(
                    'https://domain.com/.well-known/nostr.json?name=_',
                    'get'
                );
                expect(result).toEqual({
                    pubkey: validHex,
                    relays: undefined
                });
            });

            it('resolves to null when the Tor request fails', async () => {
                mockDoTorRequest.mockRejectedValue(new Error('HTTP 404'));

                await expect(
                    NostrUtils.queryNip05Profile('satoshi@domain.com', true)
                ).resolves.toBe(null);
                expect(mockFetch).not.toHaveBeenCalled();
            });

            it('resolves to null for malformed responses', async () => {
                for (const body of [
                    undefined,
                    'not json',
                    {},
                    { names: null },
                    { names: 'satoshi' },
                    { names: {} },
                    { names: { other: validHex } },
                    { names: { satoshi: 42 } },
                    { names: { satoshi: 'not-a-pubkey' } },
                    { names: { satoshi: validHex.toUpperCase() } }
                ]) {
                    mockDoTorRequest.mockResolvedValueOnce(body);
                    await expect(
                        NostrUtils.queryNip05Profile('satoshi@domain.com', true)
                    ).resolves.toBe(null);
                }
            });

            it('does not read inherited properties as names', async () => {
                mockDoTorRequest.mockResolvedValue({ names: {} });

                await expect(
                    NostrUtils.queryNip05Profile('constructor@domain.com', true)
                ).resolves.toBe(null);
            });

            it('drops non-string relay entries', async () => {
                mockDoTorRequest.mockResolvedValue({
                    names: { satoshi: validHex },
                    relays: { [validHex]: ['wss://relay.example.com', 1] }
                });

                await expect(
                    NostrUtils.queryNip05Profile('satoshi@domain.com', true)
                ).resolves.toEqual({
                    pubkey: validHex,
                    relays: ['wss://relay.example.com']
                });
            });

            it('rejects identifiers that are not NIP-05', async () => {
                await expect(
                    NostrUtils.queryNip05Profile('not an identifier', true)
                ).resolves.toBe(null);
                expect(mockDoTorRequest).not.toHaveBeenCalled();
            });

            it('does not look up .onion identifiers', async () => {
                await expect(
                    NostrUtils.queryNip05Profile(
                        'satoshi@2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion',
                        true
                    )
                ).resolves.toBe(null);
                expect(mockDoTorRequest).not.toHaveBeenCalled();
            });
        });

        it('does not use Tor when Tor is disabled', async () => {
            mockDoTorRequest.mockReset();
            mockQueryProfile.mockResolvedValue({ pubkey: validHex });

            await NostrUtils.queryNip05Profile('satoshi@domain.com', false);

            expect(mockQueryProfile).toHaveBeenCalledWith('satoshi@domain.com');
            expect(mockDoTorRequest).not.toHaveBeenCalled();
        });

        it('still looks up a domain that only contains onion', async () => {
            mockQueryProfile.mockResolvedValue({ pubkey: validHex });

            await NostrUtils.queryNip05Profile('satoshi@onion.example');

            expect(mockQueryProfile).toHaveBeenCalledWith(
                'satoshi@onion.example'
            );
        });
    });
});
