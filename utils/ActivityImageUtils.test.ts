jest.mock('dateformat', () => ({}));
jest.mock('./LocaleUtils', () => ({ localeString: (s: string) => s }));
jest.mock('../stores/Stores', () => ({ notesStore: { notes: {} } }));
jest.mock('../cashu-cdk', () => ({}));
jest.mock('react-native-fs', () => ({ DocumentDirectoryPath: '/documents' }));

import { Image } from 'react-native';
import type Contact from '../models/Contact';
import CashuInvoice from '../models/CashuInvoice';
import CashuPayment from '../models/CashuPayment';
import CashuToken from '../models/CashuToken';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Transaction from '../models/Transaction';
import Bolt11Utils from './Bolt11Utils';
import {
    getActivityContactPhoto,
    getActivityLnurlImage
} from './ActivityImageUtils';

const contact = (data: Partial<Contact> = {}): Contact =>
    ({ photo: 'rnfs://alice.png', ...data } as Contact);
const history = (metadata: unknown, lnurl = 'lnurl1alice') => ({
    lnurl,
    metadata: { metadata: JSON.stringify(metadata) }
});

afterEach(() => jest.restoreAllMocks());

describe('getActivityContactPhoto', () => {
    it('normalizes local photos and prefers explicit payment destinations', () => {
        const decode = jest.spyOn(Bolt11Utils, 'decode');
        expect(
            getActivityContactPhoto(
                new Payment({ destination: 'alice', payment_request: 'bad' }),
                [contact({ pubkey: ['alice'] })]
            )
        ).toBe('file:///documents/alice.png');
        expect(decode).not.toHaveBeenCalled();
    });

    it('normalizes preset photos', () => {
        jest.spyOn(Image, 'resolveAssetSource').mockReturnValue({
            uri: 'asset://alice',
            width: 1,
            height: 1,
            scale: 1
        });
        expect(
            getActivityContactPhoto(new Payment({ destination: 'alice' }), [
                contact({ pubkey: ['alice'], photo: 'preset://alby' })
            ])
        ).toBe('asset://alice');
    });

    it('decodes only when a contact has a usable pubkey', () => {
        const decode = jest.spyOn(Bolt11Utils, 'decode').mockReturnValue({
            destination: 'alice'
        } as any);
        const payment = new Payment({ payment_request: 'invoice' });
        for (const contacts of [[], [contact()], [contact({ pubkey: [''] })]]) {
            expect(getActivityContactPhoto(payment, contacts)).toBeUndefined();
        }
        expect(decode).not.toHaveBeenCalled();
        expect(
            getActivityContactPhoto(payment, [contact({ pubkey: ['alice'] })])
        ).toBe('file:///documents/alice.png');
        expect(decode).toHaveBeenCalledTimes(1);
    });

    it('handles malformed payment requests', () => {
        expect(
            getActivityContactPhoto(new Payment({ payment_request: 'bad' }), [
                contact({ pubkey: ['alice'] })
            ])
        ).toBeUndefined();
    });

    it('prefers exact stored LNURL over metadata and the service pubkey', () => {
        expect(
            getActivityContactPhoto(
                new Payment({ destination: 'service' }),
                [
                    contact({ pubkey: ['service'], photo: 'service.png' }),
                    contact({
                        lnAddress: ['bob@example.com'],
                        photo: 'bob.png'
                    }),
                    contact({ lnAddress: ['lnurl1alice'] })
                ],
                history([['text/identifier', 'bob@example.com']])
            )
        ).toBe('file:///documents/alice.png');
    });

    it.each(['text/plain', 'text/identifier'])(
        'matches a complete %s lightning address case-insensitively',
        (type) => {
            expect(
                getActivityContactPhoto(
                    new CashuPayment({}),
                    [contact({ lnAddress: ['Alice@example.com'] })],
                    history([[type, ' ALICE@example.com ']])
                )
            ).toBe('file:///documents/alice.png');
        }
    );

    it.each([
        'bad json',
        'null',
        '{}',
        '[null, 1, ["text/identifier", 123]]',
        '[["text/plain", "Pay alice@example.com"]]',
        '[["text/email", "alice@example.com"]]'
    ])(
        'never falls back to a shared service key with metadata %s',
        (metadata) => {
            const decode = jest.spyOn(Bolt11Utils, 'decode');
            expect(
                getActivityContactPhoto(
                    new Payment({
                        destination: 'service',
                        payment_request: 'bad'
                    }),
                    [
                        contact({
                            pubkey: ['service'],
                            lnAddress: ['alice@example.com']
                        })
                    ],
                    { lnurl: 'unknown', metadata: { metadata } }
                )
            ).toBeUndefined();
            expect(decode).not.toHaveBeenCalled();
        }
    );

    it('does not use pubkeys for LNURL history with no metadata', () => {
        expect(
            getActivityContactPhoto(
                new Payment({ destination: 'service' }),
                [contact({ pubkey: ['service'] })],
                { lnurl: 'unknown' }
            )
        ).toBeUndefined();
    });

    it('matches outgoing Cashu lock keys, not incoming or unmarked tokens', () => {
        const proofs = [
            { secret: JSON.stringify(['P2PK', { data: 'alice' }]) }
        ];
        const contacts = [contact({ cashuPubkey: ['alice'] })];
        expect(
            getActivityContactPhoto(
                new CashuToken({ sent: true, proofs }),
                contacts
            )
        ).toBe('file:///documents/alice.png');
        for (const flags of [
            { received: true },
            {},
            { sent: true, received: true }
        ]) {
            expect(
                getActivityContactPhoto(
                    new CashuToken({ ...flags, proofs }),
                    contacts
                )
            ).toBeUndefined();
        }
    });

    it('matches external onchain outputs but never change or unknown ownership', () => {
        const transaction = new Transaction({
            amount: -100,
            dest_addresses: ['change', 'alice', 'unknown'],
            output_details: [
                { address: 'change', is_our_address: true },
                { address: 'alice', is_our_address: false },
                { address: 'unknown' }
            ]
        });
        const alice = contact({ onchainAddress: ['alice'] });
        expect(
            getActivityContactPhoto(transaction, [
                contact({ onchainAddress: ['change'], photo: 'change.png' }),
                alice
            ])
        ).toBe('file:///documents/alice.png');
        for (const address of ['change', 'unknown']) {
            expect(
                getActivityContactPhoto(transaction, [
                    contact({ onchainAddress: [address] })
                ])
            ).toBeUndefined();
        }
        expect(
            getActivityContactPhoto(
                new Transaction({ amount: -100, dest_addresses: ['alice'] }),
                [alice]
            )
        ).toBeUndefined();
    });

    it.each([
        new Invoice({ destination: 'alice' }),
        new CashuInvoice({ destination: 'alice' }),
        new Transaction({
            amount: 100,
            dest_addresses: ['alice'],
            output_details: [{ address: 'alice', is_our_address: false }]
        }),
        new Transaction({ amount: 0, dest_addresses: ['alice'] }),
        { destination: 'alice' },
        null,
        undefined
    ])(
        'does not infer a sender or match unknown activity types: %p',
        (item) => {
            expect(
                getActivityContactPhoto(
                    item,
                    [
                        contact({
                            pubkey: ['alice'],
                            onchainAddress: ['alice'],
                            lnAddress: ['lnurl1alice']
                        })
                    ],
                    history([])
                )
            ).toBeUndefined();
        }
    );

    it('returns undefined for ambiguous matches or missing photos', () => {
        const payment = new Payment({ destination: 'alice' });
        expect(
            getActivityContactPhoto(payment, [
                contact({ pubkey: ['alice'], photo: null })
            ])
        ).toBeUndefined();
        expect(
            getActivityContactPhoto(payment, [
                contact({ pubkey: ['alice'] }),
                contact({ pubkey: ['alice'], photo: 'other.png' })
            ])
        ).toBeUndefined();
    });
});

describe('getActivityLnurlImage', () => {
    it.each(['image/png;base64', 'image/jpeg;base64'])(
        'returns a data URI for %s',
        (type) => {
            expect(
                getActivityLnurlImage(JSON.stringify([[type, 'aGVsbG8=']]))
            ).toBe(`data:${type},aGVsbG8=`);
        }
    );

    it.each([
        undefined,
        '',
        'bad json',
        'null',
        '{}',
        '"text"',
        '[null, 1, {}, []]',
        '[["image/png;base64", 123]]',
        '[["image/png;base64", ""]]',
        '[["image/png;base64", "   "]]',
        '[["image/svg+xml;base64", "abc"]]',
        '[["image/webp;base64", "abc"]]',
        '[["image/png", "https://example.com/image.png"]]'
    ])('ignores malformed or unsupported metadata: %s', (metadata) => {
        expect(getActivityLnurlImage(metadata)).toBeUndefined();
    });

    it('skips malformed entries and returns the first supported image', () => {
        expect(
            getActivityLnurlImage(
                JSON.stringify([
                    null,
                    ['image/svg+xml;base64', 'svg'],
                    ['image/jpeg;base64', 'first'],
                    ['image/png;base64', 'second']
                ])
            )
        ).toBe('data:image/jpeg;base64,first');
    });

    it('supports contact-first composition without changing inputs', () => {
        const payment = Object.freeze(new Payment({ destination: 'alice' }));
        const contacts = [
            contact({
                pubkey: ['alice'],
                photo: 'https://example.com/alice.png'
            })
        ];
        Object.freeze(contacts[0]);
        const metadata = JSON.stringify([['image/png;base64', 'fallback']]);
        expect(
            getActivityContactPhoto(payment, contacts) ||
                getActivityLnurlImage(metadata)
        ).toBe('https://example.com/alice.png');
    });
});
