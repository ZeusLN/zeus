// based on light-bolt11-decoder: Copyright (c) 2021 bitcoinjs contributors, fiatjaf

import { bech32 } from 'bech32';
import base64Utils from './Base64Utils';

class Bolt11Utils {
    constructor() {
        // reverse the keys and values of TAGCODES and insert into TAGNAMES
        for (
            let i = 0, keys = Object.keys(this.TAGCODES);
            i < keys.length;
            i++
        ) {
            const currentName = keys[i];
            const currentCode = this.TAGCODES[keys[i]].toString();
            this.TAGNAMES[currentCode] = currentName;
        }
    }

    public decode = (paymentRequest: string) => {
        if (typeof paymentRequest !== 'string')
            throw new Error('Lightning Payment Request must be string');
        if (paymentRequest.slice(0, 2).toLowerCase() !== 'ln')
            throw new Error('Not a proper lightning payment request');

        const sections: {
            name: string;
            tag?: string;
            letters: string;
            value?: any;
        }[] = [];
        const decoded = bech32.decode(paymentRequest, Number.MAX_SAFE_INTEGER);
        paymentRequest = paymentRequest.toLowerCase();
        const prefix = decoded.prefix;
        let words = decoded.words;
        let letters = paymentRequest.slice(prefix.length + 1);
        words = words.slice(0, -104);

        // Without reverse lookups, can't say that the multipier at the end must
        // have a number before it, so instead we parse, and if the second group
        // doesn't have anything, there's a good chance the last letter of the
        // coin type got captured by the third group, so just re-regex without
        // the number.
        let prefixMatches = prefix.match(/^ln(\S+?)(\d*)([a-zA-Z]?)$/);
        if (prefixMatches && !prefixMatches[2])
            prefixMatches = prefix.match(/^ln(\S+)$/);
        if (!prefixMatches) {
            throw new Error('Not a proper lightning payment request');
        }

        // "ln" section
        sections.push({
            name: 'lightning_network',
            letters: 'ln'
        });

        // "bc" section
        const bech32Prefix = prefixMatches[1];
        let coinNetwork;
        switch (bech32Prefix) {
            case this.DEFAULTNETWORK.bech32:
                coinNetwork = this.DEFAULTNETWORK;
                break;
            case this.TESTNETWORK.bech32:
                coinNetwork = this.TESTNETWORK;
                break;
            case this.REGTESTNETWORK.bech32:
                coinNetwork = this.REGTESTNETWORK;
                break;
            case this.SIMNETWORK.bech32:
                coinNetwork = this.SIMNETWORK;
                break;
        }
        if (!coinNetwork || coinNetwork.bech32 !== bech32Prefix) {
            throw new Error('Unknown coin bech32 prefix');
        }
        sections.push({
            name: 'coin_network',
            letters: bech32Prefix,
            value: coinNetwork
        });

        // "1" separator
        sections.push({
            name: 'separator',
            letters: '1'
        });

        // timestamp
        const timestamp = this.wordsToIntBE(words.slice(0, 7));
        words = words.slice(7); // trim off the left 7 words
        sections.push({
            name: 'timestamp',
            letters: letters.slice(0, 7),
            value: timestamp
        });
        letters = letters.slice(7);

        let tagName: string, parser, tagLength: number, tagWords: number[];
        // we have no tag count to go on, so just keep hacking off words
        // until we have none.
        while (words.length > 0) {
            const tagCode = words[0].toString();
            tagName = this.TAGNAMES[tagCode] || 'unknown_tag';
            parser = this.TAGPARSERS[tagCode] || this.getUnknownParser(tagCode);
            words = words.slice(1);

            tagLength = this.wordsToIntBE(words.slice(0, 2));
            words = words.slice(2);

            tagWords = words.slice(0, tagLength);
            words = words.slice(tagLength);

            sections.push({
                name: tagName,
                tag: letters[0],
                letters: letters.slice(0, 1 + 2 + tagLength),
                value: parser(tagWords) // see: parsers for more comments
            });
            letters = letters.slice(1 + 2 + tagLength);

            if (tagName === 'expiry') {
                break;
            }
        }

        let result = {
            paymentRequest,
            sections,
            timestamp,

            get expiry() {
                return sections.find((s) => s.name === 'expiry')?.value;
            }
        };

        return result;
    };

    // defaults for encode; default timestamp is current time at call
    private DEFAULTNETWORK = {
        // default network is bitcoin
        bech32: 'bc',
        pubKeyHash: 0x00,
        scriptHash: 0x05,
        validWitnessVersions: [0]
    };
    private TESTNETWORK = {
        bech32: 'tb',
        pubKeyHash: 0x6f,
        scriptHash: 0xc4,
        validWitnessVersions: [0]
    };
    private REGTESTNETWORK = {
        bech32: 'bcrt',
        pubKeyHash: 0x6f,
        scriptHash: 0xc4,
        validWitnessVersions: [0]
    };
    private SIMNETWORK = {
        bech32: 'sb',
        pubKeyHash: 0x3f,
        scriptHash: 0x7b,
        validWitnessVersions: [0]
    };

    private TAGCODES: { [tagName: string]: number } = {
        payment_hash: 1,
        payment_secret: 16,
        description: 13,
        payee: 19,
        description_hash: 23, // commit to longer descriptions (used by lnurl-pay)
        expiry: 6, // default: 3600 (1 hour)
        min_final_cltv_expiry: 24, // default: 9
        fallback_address: 9,
        metadata: 27
    };

    private TAGPARSERS: { [tagCode: string]: (words: number[]) => any } = {
        '1': (words: number[]) => this.wordsToHex(words), // 256 bits
        '16': (words: number[]) => this.wordsToHex(words), // 256 bits
        '13': (words: number[]) => this.wordsToUtf8(words), // string variable length
        '19': (words: number[]) => this.wordsToHex(words), // 264 bits
        '23': (words: number[]) => this.wordsToHex(words), // 256 bits
        '27': (words: number[]) => this.wordsToHex(words), // variable
        '6': this.wordsToIntBE, // default: 3600 (1 hour)
        '24': this.wordsToIntBE // default: 9
    };

    private TAGNAMES: { [code: string]: string } = {};

    private wordsToHex = (words: number[]): any => {
        const bytes = bech32.fromWordsUnsafe(words);
        if (bytes != null) {
            return base64Utils.bytesToHex;
        }
        return undefined;
    };

    private wordsToUtf8(words: number[]): any {
        const bytes = bech32.fromWordsUnsafe(words);
        if (bytes != null) {
            return base64Utils.bytesToUtf8(Uint8Array.from(bytes));
        }
        return undefined;
    }

    private getUnknownParser(tagCode: string) {
        return (words: number[]) => ({
            tagCode: parseInt(tagCode),
            words: bech32.encode('unknown', words, Number.MAX_SAFE_INTEGER)
        });
    }

    private wordsToIntBE(words: number[]) {
        return words.reverse().reduce((total, item, index) => {
            return total + item * Math.pow(32, index);
        }, 0);
    }
}

const bolt11Utils = new Bolt11Utils();
export default bolt11Utils;
