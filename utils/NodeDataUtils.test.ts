import {
    dropNodesWithTakenData,
    getCashuNamespace,
    getNodeDataDir,
    getSharedNodeData
} from './NodeDataUtils';

describe('NodeDataUtils', () => {
    describe('getCashuNamespace', () => {
        it.each([
            [{ implementation: 'embedded-lnd', lndDir: 'abc' }, 'abc'],
            [{ implementation: 'embedded-lnd' }, 'lnd'],
            [{ implementation: 'ldk-node', ldkNodeDir: 'def' }, 'def'],
            [{ implementation: 'ldk-node' }, 'ldk'],
            [{ implementation: 'lnd', lndDir: 'lnd' }, undefined],
            [{ implementation: 'cln-rest' }, undefined],
            [undefined, undefined]
        ])('%j -> %j', (node, expected) => {
            expect(getCashuNamespace(node)).toBe(expected);
        });
    });

    describe('getNodeDataDir', () => {
        it.each([
            [
                { implementation: 'embedded-lnd', lndDir: 'abc' },
                'embedded-lnd:abc'
            ],
            [{ implementation: 'embedded-lnd' }, 'embedded-lnd:lnd'],
            [{ implementation: 'ldk-node', ldkNodeDir: 'def' }, 'ldk-node:def'],
            [{ implementation: 'ldk-node' }, undefined],
            [{ implementation: 'lnd', lndDir: 'lnd' }, undefined],
            [undefined, undefined]
        ])('%j -> %j', (node, expected) => {
            expect(getNodeDataDir(node)).toBe(expected);
        });
    });

    describe('getSharedNodeData', () => {
        it('reports nothing shared for distinct on-device wallets', () => {
            const nodes = [
                { implementation: 'embedded-lnd', lndDir: 'a' },
                { implementation: 'embedded-lnd', lndDir: 'b' },
                { implementation: 'ldk-node', ldkNodeDir: 'c' }
            ];
            for (let i = 0; i < nodes.length; i++) {
                expect(getSharedNodeData(nodes, i)).toEqual({
                    cashu: false,
                    dataDir: false
                });
            }
        });

        it('reports both shared for a restored copy of an embedded wallet', () => {
            const nodes = [
                { implementation: 'embedded-lnd', lndDir: 'a', nickname: 'x' },
                { implementation: 'embedded-lnd', lndDir: 'a', nickname: 'y' }
            ];
            expect(getSharedNodeData(nodes, 1)).toEqual({
                cashu: true,
                dataDir: true
            });
            expect(getSharedNodeData(nodes, 0)).toEqual({
                cashu: true,
                dataDir: true
            });
        });

        it('treats an embedded config without lndDir as the legacy lnd wallet', () => {
            const nodes = [
                { implementation: 'embedded-lnd', lndDir: 'lnd' },
                { implementation: 'embedded-lnd' }
            ];
            expect(getSharedNodeData(nodes, 1)).toEqual({
                cashu: true,
                dataDir: true
            });
        });

        it('reports shared Cashu data for two ldk-node configs without ldkNodeDir', () => {
            const nodes = [
                { implementation: 'ldk-node' },
                { implementation: 'ldk-node' }
            ];
            expect(getSharedNodeData(nodes, 0)).toEqual({
                cashu: true,
                dataDir: false
            });
        });

        it('reports shared Cashu data, not a shared directory, across implementations', () => {
            const nodes = [
                { implementation: 'embedded-lnd', lndDir: 'same' },
                { implementation: 'ldk-node', ldkNodeDir: 'same' }
            ];
            expect(getSharedNodeData(nodes, 1)).toEqual({
                cashu: true,
                dataDir: false
            });
        });

        it('ignores remote configs that carry a node dir', () => {
            const nodes = [
                { implementation: 'embedded-lnd', lndDir: 'lnd' },
                { implementation: 'lnd', host: 'x', lndDir: 'lnd' }
            ];
            expect(getSharedNodeData(nodes, 0)).toEqual({
                cashu: false,
                dataDir: false
            });
            expect(getSharedNodeData(nodes, 1)).toEqual({
                cashu: false,
                dataDir: false
            });
        });
    });

    describe('dropNodesWithTakenData', () => {
        it('drops an on-device config whose data an existing config uses', () => {
            const existing = [{ implementation: 'embedded-lnd', lndDir: 'a' }];
            const incoming = [
                { implementation: 'embedded-lnd', lndDir: 'a' },
                { implementation: 'embedded-lnd', lndDir: 'b' }
            ];
            expect(dropNodesWithTakenData(incoming, existing)).toEqual([
                { implementation: 'embedded-lnd', lndDir: 'b' }
            ]);
        });

        it('drops an embedded config without lndDir when the legacy wallet exists', () => {
            const existing = [{ implementation: 'embedded-lnd' }];
            const incoming = [
                { implementation: 'embedded-lnd', lndDir: 'lnd' }
            ];
            expect(dropNodesWithTakenData(incoming, existing)).toEqual([]);
        });

        it('drops a config whose Cashu namespace another implementation uses', () => {
            const existing = [
                { implementation: 'embedded-lnd', lndDir: 'same' }
            ];
            const incoming = [
                { implementation: 'ldk-node', ldkNodeDir: 'same' }
            ];
            expect(dropNodesWithTakenData(incoming, existing)).toEqual([]);
        });

        it('keeps only the first of two incoming configs on the same data', () => {
            const incoming = [
                { implementation: 'ldk-node', ldkNodeDir: 'c', nickname: '1' },
                { implementation: 'ldk-node', ldkNodeDir: 'c', nickname: '2' }
            ];
            expect(dropNodesWithTakenData(incoming, [])).toEqual([
                { implementation: 'ldk-node', ldkNodeDir: 'c', nickname: '1' }
            ]);
        });

        it('keeps remote configs, including exact copies', () => {
            const remote = { implementation: 'lnd', host: 'x', lndDir: 'lnd' };
            const existing = [remote, { implementation: 'embedded-lnd' }];
            expect(dropNodesWithTakenData([remote, remote], existing)).toEqual([
                remote,
                remote
            ]);
        });
    });
});
