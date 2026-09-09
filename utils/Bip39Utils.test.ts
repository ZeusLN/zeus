import { createHash } from 'crypto';

import { BIP39_WORD_LIST } from '.././utils/Bip39Utils';

/**
 * The BIP39 English wordlist is wallet-critical data: it is used to build and
 * to restore seed phrases. A single altered, missing or misordered word would
 * produce mnemonics that other wallets reject, or silently break restores of
 * existing wallets, and nothing in the codebase currently guards it.
 *
 * These tests assert the properties BIP39 requires of the list, rather than
 * pinning all 2048 words, so a legitimate edit still fails loudly while the
 * test stays readable.
 *
 * Reference: https://github.com/bitcoin/bips/blob/master/bip-0039/bip-0039-wordlists.md
 */
describe('BIP39_WORD_LIST', () => {
    it('matches the canonical BIP39 English wordlist', () => {
        // sha256 of bitcoin/bips bip-0039/english.txt. This pins word
        // *identity*, which the structural checks below cannot: a substitution
        // that keeps sort position, case, length and its four-character prefix
        // -- 'absurd' -> 'absurdly', say -- passes every one of them, and that
        // is precisely the corruption that would break seed restores.
        const digest = createHash('sha256')
            .update(BIP39_WORD_LIST.join('\n') + '\n')
            .digest('hex');
        expect(digest).toBe(
            '2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda'
        );
    });

    it('contains exactly 2048 words', () => {
        // 2048 = 2^11, so each word encodes exactly 11 bits of entropy. Any
        // other length makes the mnemonic encoding wrong, not merely unusual.
        expect(BIP39_WORD_LIST).toHaveLength(2048);
    });

    it('is sorted alphabetically', () => {
        // BIP39 requires this so wallets can binary-search the list, and it is
        // what makes a word's index — and therefore the entropy it encodes —
        // well defined.
        expect(BIP39_WORD_LIST).toEqual([...BIP39_WORD_LIST].sort());
    });

    it('has no duplicate words', () => {
        expect(new Set(BIP39_WORD_LIST).size).toBe(BIP39_WORD_LIST.length);
    });

    it('has a unique first four letters for every word', () => {
        // The spec guarantees this so a phrase stays unambiguous when words are
        // truncated to four characters, which hardware wallets rely on for
        // entry. A duplicate prefix would make two different seeds collide.
        const prefixes = BIP39_WORD_LIST.map((word) => word.slice(0, 4));
        expect(new Set(prefixes).size).toBe(prefixes.length);
    });

    it('contains only lowercase a-z, with no whitespace or accents', () => {
        const offenders = BIP39_WORD_LIST.filter(
            (word) => !/^[a-z]+$/.test(word)
        );
        expect(offenders).toEqual([]);
    });

    it('has words between 3 and 8 characters long', () => {
        const lengths = BIP39_WORD_LIST.map((word) => word.length);
        expect(Math.min(...lengths)).toBe(3);
        expect(Math.max(...lengths)).toBe(8);
    });

    it('starts and ends with the expected words', () => {
        // Cheap canary: catches a truncated or shifted list immediately.
        expect(BIP39_WORD_LIST[0]).toBe('abandon');
        expect(BIP39_WORD_LIST[BIP39_WORD_LIST.length - 1]).toBe('zoo');
    });
});
