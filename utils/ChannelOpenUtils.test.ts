jest.mock('react-native-randombytes', () => ({
    randomBytes: (n: number) => jest.requireActual('crypto').randomBytes(n)
}));

import * as bitcoin from 'bitcoinjs-lib';

import {
    OPEN_MEMO_PREFIX,
    findChannelByMemo,
    getFundingOutpoints,
    makeOpenMemo,
    signingKeepsTxid
} from './ChannelOpenUtils';

describe('makeOpenMemo', () => {
    it('is the prefix plus 16 hex characters', () => {
        const memo = makeOpenMemo();
        expect(memo.startsWith(OPEN_MEMO_PREFIX)).toBe(true);
        expect(memo.slice(OPEN_MEMO_PREFIX.length)).toMatch(/^[0-9a-f]{16}$/);
    });

    it('differs between opens', () => {
        expect(makeOpenMemo()).not.toEqual(makeOpenMemo());
    });
});

describe('findChannelByMemo', () => {
    const memo = 'ZEUS open 0011223344556677';
    const options = { attempts: 3, delayMs: 0 };
    const noChannels = async () => ({ channels: [] });
    const noPending = async () => ({ pending_open_channels: [] });

    it('finds the channel among the pending opens', async () => {
        const getChannels = jest.fn(noChannels);
        const found = await findChannelByMemo(
            async () => ({
                pending_open_channels: [
                    { channel: { channel_point: 'aa:0', memo: '' } },
                    { channel: { channel_point: 'bb:1', memo } }
                ]
            }),
            getChannels,
            memo,
            options
        );

        expect(found).toEqual({ funding_txid_str: 'bb', output_index: 1 });
        expect(getChannels).not.toHaveBeenCalled();
    });

    it('finds a channel that is already open', async () => {
        const found = await findChannelByMemo(
            noPending,
            async () => ({
                channels: [{ channel_point: 'cc:2', memo }]
            }),
            memo,
            options
        );

        expect(found).toEqual({ funding_txid_str: 'cc', output_index: 2 });
    });

    it('keeps looking after a failed lookup', async () => {
        const getPendingChannels = jest
            .fn()
            .mockRejectedValueOnce(new Error('Request timeout'))
            .mockResolvedValueOnce({
                pending_open_channels: [
                    { channel: { channel_point: 'dd:0', memo } }
                ]
            });

        const found = await findChannelByMemo(
            getPendingChannels,
            noChannels,
            memo,
            options
        );

        expect(found).toEqual({ funding_txid_str: 'dd', output_index: 0 });
        expect(getPendingChannels).toHaveBeenCalledTimes(2);
    });

    it('resolves undefined when no channel has the memo', async () => {
        const getPendingChannels = jest.fn(async () => ({
            pending_open_channels: [
                {
                    channel: {
                        channel_point: 'ee:0',
                        memo: 'ZEUS open ffff'
                    }
                }
            ]
        }));

        const found = await findChannelByMemo(
            getPendingChannels,
            noChannels,
            memo,
            options
        );

        expect(found).toBeUndefined();
        expect(getPendingChannels).toHaveBeenCalledTimes(3);
    });

    it('does not report a match without a usable channel point', async () => {
        const found = await findChannelByMemo(
            async () => ({
                pending_open_channels: [{ channel: { memo } }]
            }),
            noChannels,
            memo,
            options
        );

        expect(found).toBeUndefined();
    });

    it('tolerates responses without channel lists', async () => {
        const found = await findChannelByMemo(
            async () => ({}),
            async () => ({}),
            memo,
            options
        );

        expect(found).toBeUndefined();
    });
});

describe('getFundingOutpoints', () => {
    const regtest = bitcoin.networks.regtest;
    // funding outputs are P2WSH, or P2TR for taproot channels; the
    // fixture keeps each address's script, written out by hand
    const scripts = new Map<string, Buffer>();
    const segwit = (version: number, fill: number) => {
        const data = Buffer.alloc(32, fill);
        const address = bitcoin.address.toBech32(data, version, 'bcrt');
        scripts.set(
            address,
            Buffer.concat([
                Buffer.from([version ? 0x50 + version : 0, 32]),
                data
            ])
        );
        return address;
    };
    const p2wsh = (fill: number) => segwit(0, fill);
    const p2tr = (fill: number) => segwit(1, fill);
    const change = bitcoin.payments.p2wpkh({
        hash: Buffer.alloc(20, 9),
        network: regtest
    }).address as string;

    // a funded PSBT as fundPsbt returns it: the channel outputs ZEUS asked
    // for, plus change, in the order lnd chose
    const fundedPsbt = (addresses: string[]) => {
        const psbt = new bitcoin.Psbt({ network: regtest });
        psbt.addInput({
            hash: Buffer.alloc(32, 1),
            index: 0,
            witnessUtxo: {
                script: bitcoin.address.toOutputScript(change, regtest),
                value: 1000000
            }
        });
        addresses.forEach((address, i) =>
            psbt.addOutput({
                script:
                    scripts.get(address) ||
                    bitcoin.address.toOutputScript(address, regtest),
                value: 100000 + i
            })
        );
        return psbt;
    };
    const unsignedTxid = (psbt: bitcoin.Psbt) =>
        bitcoin.Transaction.fromBuffer(psbt.data.getTransaction()).getId();

    it('finds each funding output of the unsigned transaction', () => {
        const a = p2wsh(1);
        const b = p2wsh(2);
        const psbt = fundedPsbt([change, b, a]);

        expect(getFundingOutpoints(psbt.toBase64(), [a, b])).toEqual([
            { funding_txid_str: unsignedTxid(psbt), output_index: 2 },
            { funding_txid_str: unsignedTxid(psbt), output_index: 1 }
        ]);
    });

    it('finds a taproot funding output', () => {
        const a = p2tr(3);
        const psbt = fundedPsbt([a, change]);

        expect(getFundingOutpoints(psbt.toBase64(), [a])).toEqual([
            { funding_txid_str: unsignedTxid(psbt), output_index: 0 }
        ]);
    });

    it('uses the unsigned txid, as lnd records it, for a signed nested SegWit input', () => {
        const a = p2wsh(1);
        const psbt = fundedPsbt([a, change]);
        const before = unsignedTxid(psbt);
        // a P2SH-P2WPKH input's scriptSig changes the txid of the signed
        // transaction, but lnd keys the verified channel by the unsigned one
        psbt.updateInput(0, {
            redeemScript: Buffer.from('0014' + '09'.repeat(20), 'hex')
        });
        psbt.data.inputs[0].finalScriptSig = Buffer.from(
            '160014' + '09'.repeat(20),
            'hex'
        );

        expect(getFundingOutpoints(psbt.toBase64(), [a])).toEqual([
            { funding_txid_str: before, output_index: 0 }
        ]);
    });

    it('skips an address the transaction does not pay', () => {
        const psbt = fundedPsbt([p2wsh(1), change]);

        expect(getFundingOutpoints(psbt.toBase64(), [p2wsh(7)])).toEqual([]);
    });

    it('accepts the PSBT as bytes', () => {
        const a = p2wsh(1);
        const psbt = fundedPsbt([a]);

        expect(
            getFundingOutpoints(new Uint8Array(psbt.toBuffer()), [a])
        ).toEqual([{ funding_txid_str: unsignedTxid(psbt), output_index: 0 }]);
    });
});

describe('signingKeepsTxid', () => {
    const regtest = bitcoin.networks.regtest;
    const key = Buffer.from(
        '02' +
            '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
        'hex'
    );
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: key, network: regtest });
    // P2SH-P2WPKH: signing fills in a scriptSig that pushes the redeem
    // script, which the txid commits to
    const np2wkh = bitcoin.payments.p2sh({ redeem: p2wpkh, network: regtest });
    const p2pkh = bitcoin.payments.p2pkh({ pubkey: key, network: regtest });
    // a taproot output script, written out to need no ECC library
    const p2tr = {
        output: bitcoin.script.compile([
            bitcoin.opcodes.OP_1,
            Buffer.alloc(32, 5)
        ])
    };
    const p2wsh = bitcoin.payments.p2wsh({
        redeem: { output: Buffer.from('51', 'hex') },
        network: regtest
    });

    // a transaction paying each script, for inputs that carry only the
    // full previous transaction
    const prevTx = (scripts: Buffer[]) => {
        const tx = new bitcoin.Transaction();
        tx.addInput(Buffer.alloc(32, 7), 0);
        scripts.forEach((script) => tx.addOutput(script, 100000));
        return tx;
    };

    const funded = (
        inputs: Array<
            | { witness: Buffer }
            | { nonWitness: bitcoin.Transaction; index: number }
            | {}
        >
    ) => {
        const psbt = new bitcoin.Psbt({ network: regtest });
        inputs.forEach((input: any, i) => {
            if (input.witness) {
                psbt.addInput({
                    hash: Buffer.alloc(32, i + 1),
                    index: 0,
                    witnessUtxo: { script: input.witness, value: 100000 }
                });
            } else if (input.nonWitness) {
                psbt.addInput({
                    hash: input.nonWitness.getHash(),
                    index: input.index,
                    nonWitnessUtxo: input.nonWitness.toBuffer()
                });
            } else {
                psbt.addInput({ hash: Buffer.alloc(32, i + 1), index: 0 });
            }
        });
        psbt.addOutput({ script: p2wsh.output as Buffer, value: 90000 });
        return psbt;
    };

    it.each([
        ['P2WPKH', p2wpkh.output as Buffer],
        ['P2TR', p2tr.output as Buffer],
        ['P2WSH', p2wsh.output as Buffer]
    ])('keeps the txid for a native SegWit %s input', (_, script) => {
        expect(signingKeepsTxid(funded([{ witness: script }]).toBase64())).toBe(
            true
        );
    });

    it('parses a taproot input that carries the fields lnd adds', () => {
        const xOnlyKey = key.subarray(1);
        const psbt = new bitcoin.Psbt({ network: regtest });
        psbt.addInput({
            hash: Buffer.alloc(32, 1),
            index: 0,
            witnessUtxo: {
                script: bitcoin.script.compile([
                    bitcoin.opcodes.OP_1,
                    xOnlyKey
                ]),
                value: 100000
            },
            tapInternalKey: xOnlyKey,
            tapBip32Derivation: [
                {
                    masterFingerprint: Buffer.from('deadbeef', 'hex'),
                    pubkey: xOnlyKey,
                    path: "m/86'/1'/0'/0/0",
                    leafHashes: []
                }
            ]
        });
        psbt.addOutput({ script: p2wsh.output as Buffer, value: 90000 });
        expect(signingKeepsTxid(psbt.toBase64())).toBe(true);
    });

    it('changes the txid for a nested SegWit input', () => {
        expect(
            signingKeepsTxid(
                funded([{ witness: np2wkh.output as Buffer }]).toBase64()
            )
        ).toBe(false);
    });

    it('changes the txid for a legacy input', () => {
        expect(
            signingKeepsTxid(
                funded([{ witness: p2pkh.output as Buffer }]).toBase64()
            )
        ).toBe(false);
    });

    it('changes the txid when any one input is nested SegWit', () => {
        expect(
            signingKeepsTxid(
                funded([
                    { witness: p2wpkh.output as Buffer },
                    { witness: np2wkh.output as Buffer },
                    { witness: p2tr.output as Buffer }
                ]).toBase64()
            )
        ).toBe(false);
    });

    it('reads the spent output from the previous transaction', () => {
        const prev = prevTx([np2wkh.output as Buffer, p2wpkh.output as Buffer]);

        expect(
            signingKeepsTxid(
                funded([{ nonWitness: prev, index: 1 }]).toBase64()
            )
        ).toBe(true);
        expect(
            signingKeepsTxid(
                funded([{ nonWitness: prev, index: 0 }]).toBase64()
            )
        ).toBe(false);
    });

    it('counts an input without its spent output as one that changes the txid', () => {
        expect(
            signingKeepsTxid(
                funded([{ witness: p2wpkh.output as Buffer }, {}]).toBase64()
            )
        ).toBe(false);
    });

    it('agrees with the signed transaction for a nested SegWit input', () => {
        const psbt = funded([{ witness: np2wkh.output as Buffer }]);
        const unsigned = bitcoin.Transaction.fromBuffer(
            psbt.data.getTransaction()
        ).getId();
        psbt.data.inputs[0].finalScriptSig = bitcoin.script.compile([
            p2wpkh.output as Buffer
        ]);
        psbt.data.inputs[0].finalScriptWitness = Buffer.from('00', 'hex');

        expect(psbt.extractTransaction(true).getId()).not.toBe(unsigned);
        expect(signingKeepsTxid(psbt.toBase64())).toBe(false);
    });

    it('accepts the PSBT as hex or bytes', () => {
        const psbt = funded([{ witness: p2wpkh.output as Buffer }]);

        expect(signingKeepsTxid(psbt.toHex())).toBe(true);
        expect(signingKeepsTxid(new Uint8Array(psbt.toBuffer()))).toBe(true);
    });
});
