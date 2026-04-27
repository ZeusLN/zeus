// based on light-bolt11-decoder: Copyright (c) 2021 bitcoinjs contributors, fiatjaf

import { bech32 } from 'bech32';
import BigNumber from 'bignumber.js';
import { sha256 } from '@noble/hashes/sha256';
import * as secp from '@noble/secp256k1';
import base64Utils from './Base64Utils';

interface Bolt11Network {
    bech32: string;
    pubKeyHash: number;
    scriptHash: number;
    validWitnessVersions: number[];
}

interface Bolt11Section {
    name: string;
    tag?: string;
    letters: string;
    value?: any;
}

export interface DecodedBolt11 {
    paymentRequest: string;
    prefix: string;
    network: Bolt11Network;
    timestamp: number;
    timeExpireDate?: number;
    satoshis: number | null;
    millisatoshis: string | null;
    num_satoshis: string;
    num_msat: string;
    payment_hash?: string;
    payment_secret?: string;
    description?: string;
    description_hash?: string;
    destination?: string;
    payeeNodeKey?: string;
    cltv_expiry?: number;
    metadata?: string;
    signature?: string;
    recoveryFlag?: number;
    sections: Bolt11Section[];
    expiry?: number;
}

class Bolt11Utils {
    constructor() {
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

    public decode = (paymentRequest: string): DecodedBolt11 => {
        if (typeof paymentRequest !== 'string')
            throw new Error('Lightning Payment Request must be string');
        if (paymentRequest.slice(0, 2).toLowerCase() !== 'ln')
            throw new Error('Not a proper lightning payment request');

        const sections: Bolt11Section[] = [];
        const decoded = bech32.decode(paymentRequest, Number.MAX_SAFE_INTEGER);
        paymentRequest = paymentRequest.toLowerCase();
        const prefix = decoded.prefix;
        let words = decoded.words;
        let letters = paymentRequest.slice(prefix.length + 1);

        // signature is the last 104 5-bit words (= 65 bytes: 64-byte sig + 1-byte recovery flag)
        const sigWords = words.slice(-104);
        words = words.slice(0, -104);

        let prefixMatches = prefix.match(/^ln(\S+?)(\d*)([a-zA-Z]?)$/);
        if (prefixMatches && !prefixMatches[2])
            prefixMatches = prefix.match(/^ln(\S+)$/);
        if (!prefixMatches) {
            throw new Error('Not a proper lightning payment request');
        }

        sections.push({
            name: 'lightning_network',
            letters: 'ln'
        });

        const bech32Prefix = prefixMatches[1];
        let coinNetwork: Bolt11Network | undefined;
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
            case this.SIGNETWORK.bech32:
                coinNetwork = this.SIGNETWORK;
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

        const amountValue = prefixMatches[2];
        const amountDivisor = prefixMatches[3];
        let satoshis: number | null = null;
        let millisatoshis: string | null = null;
        if (amountValue) {
            try {
                satoshis = this.hrpToSat(amountValue + amountDivisor);
            } catch (e) {
                satoshis = null;
            }
            try {
                millisatoshis = this.hrpToMillisat(amountValue + amountDivisor);
            } catch (e) {
                millisatoshis = null;
            }
        }

        sections.push({
            name: 'separator',
            letters: '1'
        });

        const timestamp = this.wordsToIntBE(words.slice(0, 7));
        words = words.slice(7);
        sections.push({
            name: 'timestamp',
            letters: letters.slice(0, 7),
            value: timestamp
        });
        letters = letters.slice(7);

        const result: DecodedBolt11 = {
            paymentRequest,
            prefix,
            network: coinNetwork,
            timestamp,
            satoshis,
            millisatoshis,
            num_satoshis:
                satoshis != null
                    ? String(satoshis)
                    : millisatoshis != null
                    ? new BigNumber(millisatoshis).idiv(1000).toString()
                    : '0',
            num_msat: millisatoshis != null ? millisatoshis : '0',
            sections
        };

        let tagName: string,
            parser: (words: number[]) => any,
            tagLength: number,
            tagWords: number[];
        while (words.length > 0) {
            const tagCode = words[0].toString();
            tagName = this.TAGNAMES[tagCode] || 'unknown_tag';
            parser = this.TAGPARSERS[tagCode] || this.getUnknownParser(tagCode);
            words = words.slice(1);

            tagLength = this.wordsToIntBE(words.slice(0, 2));
            words = words.slice(2);

            tagWords = words.slice(0, tagLength);
            words = words.slice(tagLength);

            const value = parser(tagWords);
            sections.push({
                name: tagName,
                tag: letters[0],
                letters: letters.slice(0, 1 + 2 + tagLength),
                value
            });
            letters = letters.slice(1 + 2 + tagLength);

            switch (tagName) {
                case 'payment_hash':
                    result.payment_hash = value;
                    break;
                case 'payment_secret':
                    result.payment_secret = value;
                    break;
                case 'description':
                    result.description = value;
                    break;
                case 'description_hash':
                    result.description_hash = value;
                    break;
                case 'payee':
                    result.destination = value;
                    result.payeeNodeKey = value;
                    break;
                case 'expiry':
                    result.expiry = value;
                    break;
                case 'min_final_cltv_expiry':
                    result.cltv_expiry = value;
                    break;
                case 'metadata':
                    result.metadata = value;
                    break;
            }
        }

        if (result.expiry != null) {
            result.timeExpireDate = timestamp + result.expiry;
        }

        // Recover payee pubkey from signature when no explicit payee tag was given.
        // The signed preimage is sha256( utf8(prefix) || convertBits(dataWords, 5, 8, pad=true) )
        // where dataWords are the 5-bit words excluding the trailing 104-word signature.
        try {
            const sigBytes = bech32.fromWordsUnsafe(sigWords);
            if (sigBytes && sigBytes.length === 65) {
                const signature = Uint8Array.from(sigBytes.slice(0, 64));
                const recoveryFlag = sigBytes[64];
                const dataWords = decoded.words.slice(0, -104);
                const dataBytes = this.convertBits(dataWords, 5, 8, true);
                const prefixBytes = base64Utils.utf8ToBytes(prefix);
                const toSign = new Uint8Array(
                    prefixBytes.length + dataBytes.length
                );
                toSign.set(prefixBytes, 0);
                toSign.set(dataBytes, prefixBytes.length);
                const hash = sha256(toSign);
                const pubkey = secp.recoverPublicKey(
                    hash,
                    signature,
                    recoveryFlag,
                    true
                );
                const payeeHex = base64Utils.bytesToHex(Array.from(pubkey));
                result.signature = base64Utils.bytesToHex(
                    Array.from(signature)
                );
                result.recoveryFlag = recoveryFlag;
                if (!result.payeeNodeKey) {
                    result.payeeNodeKey = payeeHex;
                }
                if (!result.destination) {
                    result.destination = payeeHex;
                }
            }
        } catch (e) {
            // Malformed signature — leave destination undefined and return the rest of the decoded fields.
        }

        return result;
    };

    private DEFAULTNETWORK: Bolt11Network = {
        bech32: 'bc',
        pubKeyHash: 0x00,
        scriptHash: 0x05,
        validWitnessVersions: [0, 1]
    };
    private TESTNETWORK: Bolt11Network = {
        bech32: 'tb',
        pubKeyHash: 0x6f,
        scriptHash: 0xc4,
        validWitnessVersions: [0, 1]
    };
    private REGTESTNETWORK: Bolt11Network = {
        bech32: 'bcrt',
        pubKeyHash: 0x6f,
        scriptHash: 0xc4,
        validWitnessVersions: [0, 1]
    };
    private SIGNETWORK: Bolt11Network = {
        bech32: 'tbs',
        pubKeyHash: 0x6f,
        scriptHash: 0xc4,
        validWitnessVersions: [0, 1]
    };
    private SIMNETWORK: Bolt11Network = {
        bech32: 'sb',
        pubKeyHash: 0x3f,
        scriptHash: 0x7b,
        validWitnessVersions: [0, 1]
    };

    private TAGCODES: { [tagName: string]: number } = {
        payment_hash: 1,
        payment_secret: 16,
        description: 13,
        payee: 19,
        description_hash: 23,
        expiry: 6,
        min_final_cltv_expiry: 24,
        fallback_address: 9,
        metadata: 27
    };

    private TAGPARSERS: { [tagCode: string]: (words: number[]) => any } = {
        '1': (words: number[]) => this.wordsToHex(words),
        '16': (words: number[]) => this.wordsToHex(words),
        '13': (words: number[]) => this.wordsToUtf8(words),
        '19': (words: number[]) => this.wordsToHex(words),
        '23': (words: number[]) => this.wordsToHex(words),
        '27': (words: number[]) => this.wordsToHex(words),
        '6': this.wordsToIntBE,
        '24': this.wordsToIntBE
    };

    private TAGNAMES: { [code: string]: string } = {};

    private MILLISATS_PER_BTC = new BigNumber('100000000000');
    private MAX_MILLISATS = new BigNumber('2100000000000000000');
    private DIVISORS: { [k: string]: BigNumber } = {
        m: new BigNumber('1000'),
        u: new BigNumber('1000000'),
        n: new BigNumber('1000000000'),
        p: new BigNumber('1000000000000')
    };

    private hrpToMillisat = (hrp: string): string => {
        let divisor: string | undefined;
        let value: string;
        const last = hrp.slice(-1);
        if (last.match(/^[munp]$/)) {
            divisor = last;
            value = hrp.slice(0, -1);
        } else if (last.match(/^[^munp0-9]$/)) {
            throw new Error('Not a valid multiplier for the amount');
        } else {
            value = hrp;
        }
        if (!value.match(/^\d+$/)) {
            throw new Error('Not a valid human readable amount');
        }
        const valueBN = new BigNumber(value);
        const msat = divisor
            ? valueBN.times(this.MILLISATS_PER_BTC).idiv(this.DIVISORS[divisor])
            : valueBN.times(this.MILLISATS_PER_BTC);
        if (
            (divisor === 'p' && !valueBN.mod(10).isZero()) ||
            msat.gt(this.MAX_MILLISATS)
        ) {
            throw new Error('Amount is outside of valid range');
        }
        return msat.toString();
    };

    private hrpToSat = (hrp: string): number => {
        const msat = new BigNumber(this.hrpToMillisat(hrp));
        if (!msat.mod(1000).isZero()) {
            throw new Error('Amount is outside of valid range');
        }
        return msat.idiv(1000).toNumber();
    };

    private wordsToHex = (words: number[]): string | undefined => {
        const bytes = bech32.fromWordsUnsafe(words);
        if (bytes != null) {
            return base64Utils.bytesToHex(bytes);
        }
        return undefined;
    };

    private wordsToUtf8(words: number[]): string | undefined {
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

    // 5-bit → 8-bit conversion, right-padding with zeros (matches bolt11's `convert` helper).
    private convertBits(
        data: number[],
        inBits: number,
        outBits: number,
        pad: boolean
    ): Uint8Array {
        let value = 0;
        let bits = 0;
        const maxV = (1 << outBits) - 1;
        const result: number[] = [];
        for (let i = 0; i < data.length; ++i) {
            value = (value << inBits) | data[i];
            bits += inBits;
            while (bits >= outBits) {
                bits -= outBits;
                result.push((value >> bits) & maxV);
            }
        }
        if (pad && bits > 0) {
            result.push((value << (outBits - bits)) & maxV);
        }
        return Uint8Array.from(result);
    }
}

const bolt11Utils = new Bolt11Utils();
export default bolt11Utils;
