import { isNamecoinIdentifier, resolveNamecoinProfile } from './NamecoinNip05';
import type { NamecoinValueFetcher } from './NamecoinNip05';

const PK_A = 'aaaa000000000000000000000000000000000000000000000000000000000001';
const PK_B = 'bbbb000000000000000000000000000000000000000000000000000000000002';
const PK_C = 'cccc000000000000000000000000000000000000000000000000000000000003';
const PK_D = 'dddd000000000000000000000000000000000000000000000000000000000004';
const PK_M = '6cdebccabda1dfa058ab85352a79509b592b2bdfa0370325e28ec1cb4f18667d';
const PK_ROOT =
    '460c25e682fda7832b52d1f22d3d22b3176d972f60dcdc3212ed8c92ef85065c';

type FixtureValue = string | null | Error;

function makeFetcher(records: Record<string, FixtureValue>): {
    fetcher: NamecoinValueFetcher;
    queries: string[];
} {
    const queries: string[] = [];
    const fetcher: NamecoinValueFetcher = async (name: string) => {
        queries.push(name);
        if (!Object.prototype.hasOwnProperty.call(records, name)) return null;
        const value = records[name];
        if (value instanceof Error) throw value;
        return value;
    };
    return { fetcher, queries };
}

function nestedMap(labels: string[], leaf: unknown): unknown {
    let value = leaf;
    for (const label of labels) {
        value = { map: { [label]: value } };
    }
    return value;
}

describe('Namecoin identifier detection and parsing', () => {
    it('recognizes dot bit, d slash, and id slash identifiers', () => {
        expect(isNamecoinIdentifier('example.bit')).toBe(true);
        expect(isNamecoinIdentifier('alice@example.bit')).toBe(true);
        expect(isNamecoinIdentifier('_@example.bit')).toBe(true);
        expect(isNamecoinIdentifier('  EXAMPLE.BIT  ')).toBe(true);
        expect(isNamecoinIdentifier('example.bit.')).toBe(true);
        expect(isNamecoinIdentifier('d/example')).toBe(true);
        expect(isNamecoinIdentifier('D/Example')).toBe(true);
        expect(isNamecoinIdentifier('id/alice')).toBe(true);
        expect(isNamecoinIdentifier('ID/Alice')).toBe(true);
    });

    it('rejects ordinary non Namecoin identifiers', () => {
        expect(isNamecoinIdentifier('alice@example.com')).toBe(false);
        expect(isNamecoinIdentifier('example.com')).toBe(false);
        expect(isNamecoinIdentifier('npub1abc')).toBe(false);
        expect(isNamecoinIdentifier('some random text')).toBe(false);
        expect(isNamecoinIdentifier('')).toBe(false);
        expect(isNamecoinIdentifier('example.bit..')).toBe(false);
    });

    it('resolves d/mstrofnone with a direct pubkey and relay array', async () => {
        const { fetcher, queries } = makeFetcher({
            'd/mstrofnone': JSON.stringify({
                nostr: {
                    pubkey: PK_M.toUpperCase(),
                    relays: [
                        'wss://relay.example.com',
                        'wss://relay2.example.com'
                    ]
                }
            })
        });

        await expect(
            resolveNamecoinProfile('  D/MSTROFNONE  ', fetcher)
        ).resolves.toEqual({
            pubkey: PK_M,
            relays: ['wss://relay.example.com', 'wss://relay2.example.com']
        });
        expect(queries).toEqual(['d/mstrofnone']);
    });

    it('normalizes bare dot bit case and one trailing dot', async () => {
        const { fetcher, queries } = makeFetcher({
            'd/example': JSON.stringify({ nostr: PK_A })
        });

        await expect(
            resolveNamecoinProfile('  ExAmPlE.BiT.  ', fetcher)
        ).resolves.toEqual({ pubkey: PK_A });
        expect(queries).toEqual(['d/example']);
    });

    it('normalizes the local part and host in name at domain dot bit', async () => {
        const { fetcher, queries } = makeFetcher({
            'd/example': JSON.stringify({
                nostr: { names: { alice: PK_A } }
            })
        });

        await expect(
            resolveNamecoinProfile('  ALICE@EXAMPLE.BIT  ', fetcher)
        ).resolves.toEqual({ pubkey: PK_A });
        expect(queries).toEqual(['d/example']);
    });

    it('maps an empty local part to the root', async () => {
        const { fetcher } = makeFetcher({
            'd/example': JSON.stringify({
                nostr: { names: { _: PK_ROOT } }
            })
        });

        await expect(
            resolveNamecoinProfile('@example.bit', fetcher)
        ).resolves.toEqual({ pubkey: PK_ROOT });
    });

    it.each([
        'alice@example.com',
        'example.com',
        'https://example.bit/path',
        'example.bit:443',
        'example.bit/path',
        '123.bit',
        '-bad.bit',
        'bad..example.bit',
        'example.bit..',
        '.example.bit',
        '*.example.bit',
        'd/',
        'd/123',
        'id/',
        'alice@@example.bit',
        'ali ce@example.bit',
        'alice\n@example.bit',
        'example\n.bit',
        'www\n.example.bit'
    ])('rejects invalid identifier %s without fetching', async (identifier) => {
        const { fetcher, queries } = makeFetcher({});
        await expect(
            resolveNamecoinProfile(identifier, fetcher)
        ).resolves.toBeNull();
        expect(queries).toEqual([]);
    });
});

describe('Namecoin Nostr extraction', () => {
    it('accepts a direct nostr string only for a root lookup', async () => {
        const root = makeFetcher({
            'd/example': JSON.stringify({ nostr: PK_A })
        });
        await expect(
            resolveNamecoinProfile('d/example', root.fetcher)
        ).resolves.toEqual({ pubkey: PK_A });

        const named = makeFetcher({
            'd/example': JSON.stringify({ nostr: PK_A })
        });
        await expect(
            resolveNamecoinProfile('alice@example.bit', named.fetcher)
        ).resolves.toBeNull();
    });

    it('selects an exact name and its relay map entry', async () => {
        const { fetcher } = makeFetcher({
            'd/example': JSON.stringify({
                nostr: {
                    names: { _: PK_ROOT, alice: PK_A },
                    relays: {
                        [PK_A]: ['wss://relay.example.com']
                    }
                }
            })
        });

        await expect(
            resolveNamecoinProfile('alice@example.bit', fetcher)
        ).resolves.toEqual({
            pubkey: PK_A,
            relays: ['wss://relay.example.com']
        });
    });

    it('falls back from a missing or invalid exact name to root', async () => {
        for (const alice of ['invalid', undefined]) {
            const names: Record<string, string> = { _: PK_ROOT };
            if (alice !== undefined) names.alice = alice;
            const { fetcher } = makeFetcher({
                'd/example': JSON.stringify({ nostr: { names } })
            });
            await expect(
                resolveNamecoinProfile('alice@example.bit', fetcher)
            ).resolves.toEqual({ pubkey: PK_ROOT });
        }
    });

    it('uses root before the first entry or direct pubkey', async () => {
        const { fetcher } = makeFetcher({
            'd/example': JSON.stringify({
                nostr: {
                    names: { m: PK_M, _: PK_ROOT },
                    pubkey: PK_A,
                    relays: ['wss://direct.example.com']
                }
            })
        });

        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toEqual({ pubkey: PK_ROOT });
    });

    it('uses only the first names entry for legacy root fallback', async () => {
        const first = makeFetcher({
            'd/testls': JSON.stringify({
                nostr: { names: { m: PK_M, other: PK_A } }
            })
        });
        await expect(
            resolveNamecoinProfile('d/testls', first.fetcher)
        ).resolves.toEqual({ pubkey: PK_M });

        const invalidFirst = makeFetcher({
            'd/testls': JSON.stringify({
                nostr: { names: { first: 'invalid', second: PK_A } }
            })
        });
        await expect(
            resolveNamecoinProfile('d/testls', invalidFirst.fetcher)
        ).resolves.toBeNull();
    });

    it('does not use an arbitrary first name for a non root lookup', async () => {
        const { fetcher } = makeFetcher({
            'd/testls': JSON.stringify({
                nostr: { names: { m: PK_M } }
            })
        });
        await expect(
            resolveNamecoinProfile('alice@testls.bit', fetcher)
        ).resolves.toBeNull();
    });

    it('uses a direct object pubkey for root but not for a named user', async () => {
        const root = makeFetcher({
            'd/example': JSON.stringify({
                nostr: { pubkey: PK_A, relays: ['wss://relay.example.com'] }
            })
        });
        await expect(
            resolveNamecoinProfile('example.bit', root.fetcher)
        ).resolves.toEqual({
            pubkey: PK_A,
            relays: ['wss://relay.example.com']
        });

        const named = makeFetcher({
            'd/example': JSON.stringify({
                nostr: { pubkey: PK_A, relays: ['wss://relay.example.com'] }
            })
        });
        await expect(
            resolveNamecoinProfile('alice@example.bit', named.fetcher)
        ).resolves.toBeNull();
    });

    it('falls back to direct pubkey after invalid root names', async () => {
        const { fetcher } = makeFetcher({
            'd/example': JSON.stringify({
                nostr: {
                    names: { first: 'invalid', second: PK_B },
                    pubkey: PK_A
                }
            })
        });
        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toEqual({ pubkey: PK_A });
    });

    it('supports identity pubkeys before root names', async () => {
        const { fetcher, queries } = makeFetcher({
            'id/alice': JSON.stringify({
                nostr: {
                    pubkey: PK_A,
                    names: { _: PK_B },
                    relays: ['wss://identity.example.com']
                }
            })
        });
        await expect(
            resolveNamecoinProfile(' ID/ALICE ', fetcher)
        ).resolves.toEqual({
            pubkey: PK_A,
            relays: ['wss://identity.example.com']
        });
        expect(queries).toEqual(['id/alice']);
    });

    it('supports identity root names with relay maps', async () => {
        const { fetcher } = makeFetcher({
            'id/bob': JSON.stringify({
                nostr: {
                    names: { _: PK_B },
                    relays: { [PK_B]: ['wss://identity.example.com'] }
                }
            })
        });
        await expect(
            resolveNamecoinProfile('id/bob', fetcher)
        ).resolves.toEqual({
            pubkey: PK_B,
            relays: ['wss://identity.example.com']
        });
    });

    it('normalizes pubkeys and supports original case relay keys', async () => {
        const upper = PK_A.toUpperCase();
        const { fetcher } = makeFetcher({
            'd/example': JSON.stringify({
                nostr: {
                    names: { alice: upper },
                    relays: { [upper]: ['wss://relay.example.com'] }
                }
            })
        });
        await expect(
            resolveNamecoinProfile('alice@example.bit', fetcher)
        ).resolves.toEqual({
            pubkey: PK_A,
            relays: ['wss://relay.example.com']
        });
    });

    it('retains primitive relay entries and drops structured entries', async () => {
        const { fetcher } = makeFetcher({
            'id/alice': JSON.stringify({
                nostr: {
                    pubkey: PK_A,
                    relays: [
                        'wss://relay.example.com',
                        42,
                        true,
                        null,
                        { url: 'wss://ignored.example.com' },
                        ['wss://also-ignored.example.com']
                    ]
                }
            })
        });
        await expect(
            resolveNamecoinProfile('id/alice', fetcher)
        ).resolves.toEqual({
            pubkey: PK_A,
            relays: ['wss://relay.example.com', '42', 'true']
        });
    });

    it.each(['tooshort', 'z'.repeat(64), '', PK_A.slice(1), PK_A + '\n'])(
        'rejects invalid pubkey %s',
        async (pubkey) => {
            const { fetcher } = makeFetcher({
                'd/example': JSON.stringify({ nostr: pubkey })
            });
            await expect(
                resolveNamecoinProfile('d/example', fetcher)
            ).resolves.toBeNull();
        }
    );
});

describe('Namecoin import traversal', () => {
    it('resolves m@testls.bit through d/testls importing dd/testls', async () => {
        const { fetcher, queries } = makeFetcher({
            'd/testls': JSON.stringify({ import: 'dd/testls' }),
            'dd/testls': JSON.stringify({
                nostr: {
                    names: { _: PK_ROOT, m: PK_M },
                    relays: { [PK_M]: ['wss://relay.example.com'] }
                }
            })
        });

        await expect(
            resolveNamecoinProfile('m@testls.bit', fetcher)
        ).resolves.toEqual({
            pubkey: PK_M,
            relays: ['wss://relay.example.com']
        });
        expect(queries).toEqual(['d/testls', 'dd/testls']);
    });

    it('resolves the imported testls root', async () => {
        const { fetcher } = makeFetcher({
            'd/testls': JSON.stringify({ import: 'dd/testls' }),
            'dd/testls': JSON.stringify({
                nostr: { names: { _: PK_ROOT, m: PK_M } }
            })
        });
        await expect(
            resolveNamecoinProfile('testls.bit', fetcher)
        ).resolves.toEqual({ pubkey: PK_ROOT });
    });

    it('applies local first import and later import precedence', async () => {
        const imports = makeFetcher({
            'd/example': JSON.stringify({ import: ['dd/a', 'dd/b'] }),
            'dd/a': JSON.stringify({ nostr: PK_A }),
            'dd/b': JSON.stringify({ nostr: PK_B })
        });
        await expect(
            resolveNamecoinProfile('example.bit', imports.fetcher)
        ).resolves.toEqual({ pubkey: PK_A });

        const local = makeFetcher({
            'd/example': JSON.stringify({
                import: [['dd/a'], ['dd/b']],
                nostr: PK_C
            }),
            'dd/a': JSON.stringify({ nostr: PK_A }),
            'dd/b': JSON.stringify({ nostr: PK_B })
        });
        await expect(
            resolveNamecoinProfile('example.bit', local.fetcher)
        ).resolves.toEqual({ pubkey: PK_C });
    });

    it('supports pair shorthand and DNS selector order', async () => {
        const { fetcher, queries } = makeFetcher({
            'd/example': JSON.stringify({ import: ['dd/lib', 'a.b'] }),
            'dd/lib': JSON.stringify({ import: 'dd/defaults' }),
            'dd/defaults': JSON.stringify(
                nestedMap(['a', 'b'], { nostr: PK_A })
            )
        });
        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toEqual({ pubkey: PK_A });
        expect(queries).toEqual(['d/example', 'dd/lib', 'dd/defaults']);
    });

    it('fails closed after a missing import despite local nostr', async () => {
        const { fetcher, queries } = makeFetcher({
            'd/example': JSON.stringify({
                import: 'dd/missing',
                nostr: PK_A
            })
        });
        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toBeNull();
        expect(queries).toEqual(['d/example', 'dd/missing']);
    });

    it('converts import fetcher errors to failure without local fallback', async () => {
        const { fetcher } = makeFetcher({
            'd/example': JSON.stringify({
                import: 'dd/broken',
                nostr: PK_A
            }),
            'dd/broken': new Error('transport failed')
        });
        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toBeNull();
    });

    it('rejects malformed import shapes despite local nostr', async () => {
        const { fetcher, queries } = makeFetcher({
            'd/example': JSON.stringify({ import: 42, nostr: PK_A })
        });
        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toBeNull();
        expect(queries).toEqual(['d/example']);
    });

    it('rejects oversized import tuples before fetching the target', async () => {
        const { fetcher, queries } = makeFetcher({
            'd/example': JSON.stringify({
                import: [['dd/target', '', 'unexpected']]
            }),
            'dd/target': JSON.stringify({ nostr: PK_A })
        });
        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toBeNull();
        expect(queries).toEqual(['d/example']);
    });

    it('fails closed when an imported value is malformed JSON', async () => {
        const { fetcher } = makeFetcher({
            'd/example': JSON.stringify({
                import: 'dd/broken',
                nostr: PK_A
            }),
            'dd/broken': '{not json'
        });
        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toBeNull();
    });

    it('fails closed when an import selector is absent', async () => {
        const { fetcher } = makeFetcher({
            'd/example': JSON.stringify({
                import: [['dd/lib', 'missing']],
                nostr: PK_A
            }),
            'dd/lib': JSON.stringify({ map: {} })
        });
        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toBeNull();
    });

    it('accepts null and empty imports', async () => {
        for (const importValue of [null, []]) {
            const { fetcher } = makeFetcher({
                'd/example': JSON.stringify({
                    import: importValue,
                    nostr: PK_A
                })
            });
            await expect(
                resolveNamecoinProfile('example.bit', fetcher)
            ).resolves.toEqual({ pubkey: PK_A });
        }
    });

    it('memoizes diamond imports', async () => {
        const { fetcher, queries } = makeFetcher({
            'd/example': JSON.stringify({ import: [['dd/a'], ['dd/b']] }),
            'dd/a': JSON.stringify({ import: 'dd/shared' }),
            'dd/b': JSON.stringify({ import: 'dd/shared' }),
            'dd/shared': JSON.stringify({ nostr: PK_A })
        });
        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toEqual({ pubkey: PK_A });
        expect(queries).toEqual(['d/example', 'dd/a', 'dd/shared', 'dd/b']);
    });
});

describe('Namecoin delegate traversal', () => {
    it('uses delegate exclusively instead of local nostr', async () => {
        const { fetcher } = makeFetcher({
            'd/example': JSON.stringify({
                delegate: 'dd/target',
                nostr: PK_A
            }),
            'dd/target': JSON.stringify({ nostr: PK_B })
        });
        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toEqual({ pubkey: PK_B });
    });

    it('does not resurrect local nostr when delegate has no identity', async () => {
        const { fetcher } = makeFetcher({
            'd/example': JSON.stringify({
                delegate: 'dd/target',
                nostr: PK_A
            }),
            'dd/target': JSON.stringify({ info: 'no identity' })
        });
        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toBeNull();
    });

    it('fails closed after a missing delegate', async () => {
        const { fetcher } = makeFetcher({
            'd/example': JSON.stringify({
                delegate: 'dd/missing',
                nostr: PK_A
            })
        });
        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toBeNull();
    });

    it('rejects multiple delegate targets before fetching them', async () => {
        const { fetcher, queries } = makeFetcher({
            'd/example': JSON.stringify({ delegate: ['dd/a', 'dd/b'] }),
            'dd/a': JSON.stringify({ nostr: PK_A }),
            'dd/b': JSON.stringify({ nostr: PK_B })
        });
        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toBeNull();
        expect(queries).toEqual(['d/example']);
    });

    it('applies delegate selectors before the original subdomain', async () => {
        const { fetcher } = makeFetcher({
            'd/example': JSON.stringify({
                map: {
                    www: { delegate: ['dd/target', 'a.b'], nostr: PK_A }
                }
            }),
            'dd/target': JSON.stringify(
                nestedMap(['x', 'a', 'b'], { nostr: PK_B })
            )
        });
        await expect(
            resolveNamecoinProfile('x.www.example.bit', fetcher)
        ).resolves.toEqual({ pubkey: PK_B });
    });
});

describe('Namecoin map traversal', () => {
    it('descends multiple labels in DNS order with one apex lookup', async () => {
        const { fetcher, queries } = makeFetcher({
            'd/example': JSON.stringify(nestedMap(['a', 'b'], { nostr: PK_A })),
            'd/a.b.example': JSON.stringify({ nostr: PK_D })
        });
        await expect(
            resolveNamecoinProfile('a.b.example.bit', fetcher)
        ).resolves.toEqual({ pubkey: PK_A });
        expect(queries).toEqual(['d/example']);
    });

    it('selects exact then wildcard while local beats default', async () => {
        const record = JSON.stringify({
            nostr: PK_D,
            map: {
                '': { nostr: PK_C },
                '*': { nostr: PK_B },
                www: { nostr: PK_A }
            }
        });
        for (const [identifier, pubkey] of [
            ['www.example.bit', PK_A],
            ['other.example.bit', PK_B],
            ['example.bit', PK_D]
        ]) {
            const { fetcher } = makeFetcher({ 'd/example': record });
            await expect(
                resolveNamecoinProfile(identifier, fetcher)
            ).resolves.toEqual({ pubkey });
        }
    });

    it('uses a default child at apex but not as a wildcard', async () => {
        const record = JSON.stringify({ map: { '': { nostr: PK_C } } });
        const apex = makeFetcher({ 'd/example': record });
        await expect(
            resolveNamecoinProfile('example.bit', apex.fetcher)
        ).resolves.toEqual({ pubkey: PK_C });

        const unknown = makeFetcher({ 'd/example': record });
        await expect(
            resolveNamecoinProfile('unknown.example.bit', unknown.fetcher)
        ).resolves.toBeNull();
    });

    it('does not traverse unrelated map branches', async () => {
        const { fetcher, queries } = makeFetcher({
            'd/example': JSON.stringify({
                map: {
                    www: { nostr: PK_A },
                    other: { import: 'dd/unrelated' },
                    wildcardSource: { delegate: 'dd/also-unrelated' }
                }
            })
        });
        await expect(
            resolveNamecoinProfile('www.example.bit', fetcher)
        ).resolves.toEqual({ pubkey: PK_A });
        expect(queries).toEqual(['d/example']);
    });

    it('fails closed for a malformed exact child instead of wildcard', async () => {
        const { fetcher } = makeFetcher({
            'd/example': JSON.stringify({
                map: { www: 42, '*': { nostr: PK_B } }
            })
        });
        await expect(
            resolveNamecoinProfile('www.example.bit', fetcher)
        ).resolves.toBeNull();
    });

    it('ignores inherited map properties when choosing exact children', async () => {
        const { fetcher } = makeFetcher({
            'd/example': JSON.stringify({
                map: { '*': { nostr: PK_B } }
            })
        });
        await expect(
            resolveNamecoinProfile('constructor.example.bit', fetcher)
        ).resolves.toEqual({ pubkey: PK_B });
    });

    it('fails closed after a default child import fails', async () => {
        const { fetcher } = makeFetcher({
            'd/example': JSON.stringify({
                nostr: PK_A,
                map: { '': { import: 'dd/missing' } }
            })
        });
        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toBeNull();
    });
});

describe('Namecoin traversal bounds and failures', () => {
    it('detects import cycles with bounded lookups', async () => {
        const { fetcher, queries } = makeFetcher({
            'd/loop': JSON.stringify({ import: 'dd/a', nostr: PK_A }),
            'dd/a': JSON.stringify({ import: 'd/loop' })
        });
        await expect(
            resolveNamecoinProfile('loop.bit', fetcher)
        ).resolves.toBeNull();
        expect(queries).toEqual(['d/loop', 'dd/a']);
    });

    it('allows exactly 16 lookups in one traversal', async () => {
        const names = Array.from({ length: 15 }, (_, index) => `dd/n${index}`);
        const records: Record<string, FixtureValue> = {
            'd/budget': JSON.stringify({ import: names.map((name) => [name]) })
        };
        for (const name of names.slice(0, -1)) {
            records[name] = JSON.stringify({});
        }
        records[names[names.length - 1]] = JSON.stringify({ nostr: PK_A });
        const { fetcher, queries } = makeFetcher(records);

        await expect(
            resolveNamecoinProfile('budget.bit', fetcher)
        ).resolves.toEqual({ pubkey: PK_A });
        expect(queries).toHaveLength(16);
    });

    it('fails closed instead of starting lookup 17', async () => {
        const names = Array.from({ length: 16 }, (_, index) => `dd/n${index}`);
        const records: Record<string, FixtureValue> = {
            'd/budget': JSON.stringify({
                import: names.map((name) => [name]),
                nostr: PK_D
            })
        };
        for (const name of names) records[name] = JSON.stringify({});
        const { fetcher, queries } = makeFetcher(records);

        await expect(
            resolveNamecoinProfile('budget.bit', fetcher)
        ).resolves.toBeNull();
        expect(queries).toHaveLength(16);
        expect(queries).not.toContain('dd/n15');
    });

    it('supports map traversal at depth 16', async () => {
        const labels = Array.from({ length: 16 }, (_, index) => `l${index}`);
        const { fetcher, queries } = makeFetcher({
            'd/depth': JSON.stringify(nestedMap(labels, { nostr: PK_A }))
        });
        await expect(
            resolveNamecoinProfile(`${labels.join('.')}.depth.bit`, fetcher)
        ).resolves.toEqual({ pubkey: PK_A });
        expect(queries).toEqual(['d/depth']);
    });

    it('fails closed beyond depth 16', async () => {
        const labels = Array.from({ length: 17 }, (_, index) => `l${index}`);
        const { fetcher, queries } = makeFetcher({
            'd/depth': JSON.stringify(nestedMap(labels, { nostr: PK_A }))
        });
        await expect(
            resolveNamecoinProfile(`${labels.join('.')}.depth.bit`, fetcher)
        ).resolves.toBeNull();
        expect(queries).toEqual(['d/depth']);
    });

    it('converts root fetcher errors to null', async () => {
        const { fetcher } = makeFetcher({
            'd/example': new Error('transport failed')
        });
        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toBeNull();
    });

    it.each(['not json at all', '[]', 'null', '"string"', '42'])(
        'rejects malformed or non object value %s',
        async (value) => {
            const { fetcher } = makeFetcher({ 'd/example': value });
            await expect(
                resolveNamecoinProfile('example.bit', fetcher)
            ).resolves.toBeNull();
        }
    );

    it('does not allow prototype keys from imports to supply nostr', async () => {
        const { fetcher } = makeFetcher({
            'd/example': JSON.stringify({
                import: 'dd/shared',
                ip: '192.0.2.1'
            }),
            'dd/shared': `{"__proto__":{"nostr":"${PK_A}"}}`
        });
        await expect(
            resolveNamecoinProfile('example.bit', fetcher)
        ).resolves.toBeNull();
    });
});
