import { assertValidNodeDir, isValidNodeDir } from './NodeDirUtils';

describe('NodeDirUtils', () => {
    describe('isValidNodeDir', () => {
        it.each(['lnd', 'ldk', '0b7d5a8e-3c1f-4f2a-9e6d-2a1b3c4d5e6f', 'a_b'])(
            'accepts %j',
            (nodeDir) => {
                expect(isValidNodeDir(nodeDir)).toBe(true);
            }
        );

        it.each([
            '',
            '.',
            '..',
            '../victim',
            '../../files',
            'a/b',
            '/data',
            'a\\b',
            'lnd/..',
            ' lnd',
            'lnd\n',
            undefined,
            null,
            1,
            {},
            ['lnd']
        ])('rejects %j', (nodeDir) => {
            expect(isValidNodeDir(nodeDir)).toBe(false);
        });
    });

    describe('assertValidNodeDir', () => {
        it('returns for a valid directory', () => {
            expect(() => assertValidNodeDir('lnd')).not.toThrow();
        });

        it('throws for a traversal path', () => {
            expect(() => assertValidNodeDir('../victim')).toThrow(
                'Invalid node directory'
            );
        });
    });
});
