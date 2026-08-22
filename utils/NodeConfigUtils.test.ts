import * as CryptoJS from 'crypto-js';

import {
    saveNodeConfigs,
    exportNodeConfigs,
    decryptExportData,
    decryptExportDataV2,
    EXPORT_FORMAT_VERSION
} from './NodeConfigUtils';
import SettingsStore, { Settings } from '../stores/SettingsStore';

// In-memory filesystem keyed by absolute path. Honors 'utf8' vs 'base64'
// encodings so the export -> decrypt round trip exercises the real plumbing.
const mockFiles: Record<string, Buffer> = {};

jest.mock('react-native-fs', () => ({
    CachesDirectoryPath: '/cache',
    DownloadDirectoryPath: '/downloads',
    DocumentDirectoryPath: '/documents',
    // A path "exists" if it is a file or a directory containing files.
    exists: (p: string) =>
        Promise.resolve(
            Object.prototype.hasOwnProperty.call(mockFiles, p) ||
                Object.keys(mockFiles).some((f) => f.startsWith(`${p}/`))
        ),
    mkdir: () => Promise.resolve(),
    // Like RNFS, unlink on a directory removes its contents recursively.
    unlink: (p: string) => {
        delete mockFiles[p];
        for (const f of Object.keys(mockFiles)) {
            if (f.startsWith(`${p}/`)) delete mockFiles[f];
        }
        return Promise.resolve();
    },
    writeFile: (p: string, data: string, enc: string) => {
        mockFiles[p] = Buffer.from(data, enc === 'base64' ? 'base64' : 'utf8');
        return Promise.resolve();
    },
    readFile: (p: string, enc: string) => {
        const buf = mockFiles[p];
        if (!buf) return Promise.reject(new Error(`ENOENT: ${p}`));
        return Promise.resolve(
            buf.toString(enc === 'base64' ? 'base64' : 'utf8')
        );
    }
}));

// Fake native GCM: a reversible, password-checked wire format standing in for
// the real ZipUtils AES-256-GCM primitive. Format: [0x01][passLen][pass][pt].
// decryptFile rejects on a password mismatch, mirroring a GCM tag failure.
jest.mock('./ZipUtils', () => ({
    encryptFile: (input: string, output: string, pass: string) => {
        const plain = mockFiles[input];
        if (!plain) return Promise.reject(new Error('no input'));
        const passBuf = Buffer.from(pass, 'utf8');
        mockFiles[output] = Buffer.concat([
            Buffer.from([0x01, passBuf.length]),
            passBuf,
            plain
        ]);
        return Promise.resolve();
    },
    decryptFile: (input: string, output: string, pass: string) => {
        const blob = mockFiles[input];
        if (!blob) return Promise.reject(new Error('no input'));
        const passLen = blob[1];
        const storedPass = blob.slice(2, 2 + passLen).toString('utf8');
        if (storedPass !== pass) {
            return Promise.reject(new Error('AEADBadTagException'));
        }
        mockFiles[output] = blob.slice(2 + passLen);
        return Promise.resolve();
    }
}));

let capturedEnvelope: string | undefined;
const mockSaveDocuments = jest
    .fn()
    .mockImplementation(async ({ sourceUris }: any) => {
        // Capture the file exactly as the save dialog copies it into the
        // user-chosen destination.
        capturedEnvelope =
            mockFiles[sourceUris[0].replace('file://', '')]?.toString('utf8');
        return [{ uri: 'content://saved', name: null, error: null }];
    });
jest.mock('@react-native-documents/picker', () => ({
    saveDocuments: (...args: any[]) => mockSaveDocuments(...args)
}));

const mockUpdateSettings = jest.fn().mockResolvedValue(undefined);
const createMockSettingsStore = (nodes?: any[]): Partial<SettingsStore> => ({
    settings: { nodes } as any as Settings,
    updateSettings: mockUpdateSettings
});

const testNodes = [
    {
        implementation: 'lnd',
        host: 'mynode.example.com',
        macaroonHex: 'deadbeefcafe',
        dismissCustodialWarning: true
    } as any
];

describe('NodeConfigUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        for (const key of Object.keys(mockFiles)) delete mockFiles[key];
        capturedEnvelope = undefined;
    });

    describe('saveNodeConfigs', () => {
        it('appends new nodes to existing nodes', async () => {
            const store = createMockSettingsStore([
                { implementation: 'lnd', dismissCustodialWarning: true } as any
            ]);
            const newNodes = [
                {
                    implementation: 'cln-rest',
                    dismissCustodialWarning: true
                } as any
            ];

            await saveNodeConfigs(newNodes, store as SettingsStore);

            expect(mockUpdateSettings).toHaveBeenCalledWith({
                nodes: [
                    { implementation: 'lnd', dismissCustodialWarning: true },
                    {
                        implementation: 'cln-rest',
                        dismissCustodialWarning: true
                    }
                ]
            });
        });

        it('appends when no existing nodes are present', async () => {
            const store = createMockSettingsStore();
            const newNodes = [
                { implementation: 'lnd', dismissCustodialWarning: true } as any
            ];

            await saveNodeConfigs(newNodes, store as SettingsStore);

            expect(mockUpdateSettings).toHaveBeenCalledWith({
                nodes: [
                    { implementation: 'lnd', dismissCustodialWarning: true }
                ]
            });
        });
    });

    describe('exportNodeConfigs', () => {
        it('produces a v2 encrypted envelope and saves it via the system save dialog', async () => {
            await exportNodeConfigs(testNodes, 'hunter2');

            expect(mockSaveDocuments).toHaveBeenCalledTimes(1);
            const saveArg = mockSaveDocuments.mock.calls[0][0];
            expect(saveArg.mimeType).toBe('application/json');
            expect(saveArg.copy).toBe(true);
            expect(saveArg.sourceUris).toHaveLength(1);
            expect(saveArg.sourceUris[0]).toContain('file:///cache/');
            expect(saveArg.sourceUris[0]).toContain(
                '.zeus-wallet-config-backup'
            );
            expect(saveArg.fileName).toMatch(/\.zeus-wallet-config-backup$/);

            const envelope = JSON.parse(capturedEnvelope as string);
            expect(envelope.version).toBe(EXPORT_FORMAT_VERSION);
            expect(envelope.encrypted).toBe(true);
            expect(typeof envelope.data).toBe('string');
        });

        it('never writes the export to shared Downloads', async () => {
            await exportNodeConfigs(testNodes, 'hunter2');
            const wroteToDownloads = Object.keys(mockFiles).some((p) =>
                p.startsWith('/downloads')
            );
            expect(wroteToDownloads).toBe(false);
        });

        it('cleans up all staged files after a successful export', async () => {
            await exportNodeConfigs(testNodes, 'hunter2');

            // saveDocuments copies the envelope to the destination before
            // resolving, so nothing needs to survive in cache.
            expect(Object.keys(mockFiles)).toHaveLength(0);
        });

        it('cleans up staged files when the user cancels the save dialog', async () => {
            mockSaveDocuments.mockRejectedValueOnce(
                Object.assign(new Error('user canceled'), {
                    code: 'OPERATION_CANCELED'
                })
            );

            await expect(
                exportNodeConfigs(testNodes, 'hunter2')
            ).rejects.toThrow();

            expect(Object.keys(mockFiles)).toHaveLength(0);
        });

        it('surfaces a write error reported by the save dialog', async () => {
            mockSaveDocuments.mockResolvedValueOnce([
                { uri: 'content://saved', name: null, error: 'write failed' }
            ]);

            await expect(
                exportNodeConfigs(testNodes, 'hunter2')
            ).rejects.toThrow('write failed');

            expect(Object.keys(mockFiles)).toHaveLength(0);
        });

        it('sweeps envelopes left by earlier share-sheet builds', async () => {
            const stale =
                '/cache/nodeconfig-exports/20200101-000000.zeus-wallet-config-backup';
            mockFiles[stale] = Buffer.from('old export', 'utf8');

            await exportNodeConfigs(testNodes, 'hunter2');

            expect(mockFiles[stale]).toBeUndefined();
            expect(Object.keys(mockFiles)).toHaveLength(0);
        });

        it('refuses to export without a password', async () => {
            await expect(exportNodeConfigs(testNodes, '')).rejects.toThrow();

            expect(mockSaveDocuments).not.toHaveBeenCalled();
            expect(Object.keys(mockFiles)).toHaveLength(0);
        });

        it('does not emit any node credential in cleartext', async () => {
            await exportNodeConfigs(testNodes, 'hunter2');
            const envelope = JSON.parse(capturedEnvelope as string);
            expect(JSON.stringify(envelope)).not.toContain('deadbeefcafe');
        });
    });

    describe('decryptExportDataV2', () => {
        it('round-trips an exported v2 backup with the correct password', async () => {
            await exportNodeConfigs(testNodes, 'hunter2');
            const envelope = JSON.parse(capturedEnvelope as string);

            const nodes = await decryptExportDataV2(envelope.data, 'hunter2');
            expect(nodes).toEqual(testNodes);
        });

        it('rejects a wrong password', async () => {
            await exportNodeConfigs(testNodes, 'hunter2');
            const envelope = JSON.parse(capturedEnvelope as string);

            await expect(
                decryptExportDataV2(envelope.data, 'wrong')
            ).rejects.toBeDefined();
        });
    });

    describe('decryptExportData (legacy v1)', () => {
        it('still decrypts a CryptoJS passphrase-mode backup', () => {
            // Known-answer for backward compatibility with pre-v2 exports
            // created via CryptoJS 4.2.0 passphrase mode.
            const v1Blob = CryptoJS.AES.encrypt(
                JSON.stringify({ nodes: testNodes }),
                'legacy-pass'
            ).toString();

            const nodes = decryptExportData(v1Blob, 'legacy-pass');
            expect(nodes).toEqual(testNodes);
        });

        it('throws on a wrong password', () => {
            const v1Blob = CryptoJS.AES.encrypt(
                JSON.stringify({ nodes: testNodes }),
                'legacy-pass'
            ).toString();

            expect(() => decryptExportData(v1Blob, 'nope')).toThrow();
        });
    });

    it('exports the current format version as 2', () => {
        expect(EXPORT_FORMAT_VERSION).toBe(2);
    });
});
