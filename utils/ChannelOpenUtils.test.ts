jest.mock('react-native-randombytes', () => ({
    randomBytes: (n: number) => jest.requireActual('crypto').randomBytes(n)
}));

import * as bitcoin from 'bitcoinjs-lib';

import {
    OPEN_MEMO_PREFIX,
    findChannelByMemo,
    getFundingOutpoints,
    makeOpenMemo
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
