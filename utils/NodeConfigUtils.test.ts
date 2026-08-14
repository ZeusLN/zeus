import RNFS from 'react-native-fs';
import * as CryptoJS from 'crypto-js';

import {
    saveNodeConfigs,
    createExportFileContent,
    saveNodeConfigExportFile,
    decryptExportData,
    EXPORT_FORMAT_VERSION,
    NodeConfigExport
} from './NodeConfigUtils';
import SettingsStore, { Node, Settings } from '../stores/SettingsStore';

// Mock for RNFS
jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/test/document/path',
    DownloadDirectoryPath: '/test/download/path',
    writeFile: jest.fn().mockResolvedValue(true)
}));

// Mock for SettingsStore
const mockUpdateSettings = jest.fn().mockResolvedValue(undefined);
const createMockSettingsStore = (nodes?: any[]): Partial<SettingsStore> => ({
    settings: { nodes } as any as Settings,
    updateSettings: mockUpdateSettings
});

// scrypt at N=16384 is deliberately slow; give the suite room for it.
jest.setTimeout(30000);

const NODES: Node[] = [
    {
        host: 'node.example.com',
        port: '8080',
        macaroonHex: 'deadbeefcafe',
        implementation: 'lnd',
        certVerification: true,
        dismissCustodialWarning: false,
        nickname: 'primary'
    },
    {
        implementation: 'lightning-node-connect',
        pairingPhrase: 'abandon abandon abandon',
        certVerification: false,
        dismissCustodialWarning: false
    }
];

const PASSWORD = 'correct horse battery staple';

const parse = (content: string): NodeConfigExport =>
    JSON.parse(content) as NodeConfigExport;

type EncryptedV2 = Extract<NodeConfigExport, { version: 2 }>;

const exportEncrypted = async (): Promise<EncryptedV2> =>
    parse(await createExportFileContent(NODES, true, PASSWORD)) as EncryptedV2;

describe('NodeConfigUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('saveNodeConfigs', () => {
        it('should add new nodes to existing nodes', async () => {
            const mockSettingsStore = createMockSettingsStore([
                {
                    id: 'existing-node',
                    name: 'Existing Node',
                    implementation: 'lnd',
                    dismissCustodialWarning: true
                } as any
            ]);

            const newNodes = [
                {
                    id: 'new-node',
                    name: 'New Node',
                    implementation: 'lnd',
                    dismissCustodialWarning: true
                } as any
            ];

            await saveNodeConfigs(newNodes, mockSettingsStore as SettingsStore);

            expect(mockUpdateSettings).toHaveBeenCalledWith({
                nodes: [
                    {
                        id: 'existing-node',
                        name: 'Existing Node',
                        implementation: 'lnd',
                        dismissCustodialWarning: true
                    },
                    {
                        id: 'new-node',
                        name: 'New Node',
                        implementation: 'lnd',
                        dismissCustodialWarning: true
                    }
                ]
            });
        });

        it('should add new nodes when no existing nodes are present', async () => {
            const emptySettingsStore = createMockSettingsStore();

            const newNodes = [
                {
                    id: 'new-node',
                    name: 'New Node',
                    implementation: 'lnd',
                    dismissCustodialWarning: true
                } as any
            ];

            await saveNodeConfigs(
                newNodes,
                emptySettingsStore as SettingsStore
            );

            expect(mockUpdateSettings).toHaveBeenCalledWith({
                nodes: [
                    {
                        id: 'new-node',
                        name: 'New Node',
                        implementation: 'lnd',
                        dismissCustodialWarning: true
                    }
                ]
            });
        });
    });

    describe('saveNodeConfigExportFile', () => {
        it('should save file successfully and return the path', async () => {
            const mockWriteFile = jest.spyOn(RNFS, 'writeFile');
            const fileName = 'test-export.backup';
            const data = 'test-data';

            const path = await saveNodeConfigExportFile(fileName, data);

            expect(mockWriteFile).toHaveBeenCalledWith(
                expect.stringContaining(fileName), // exact path doesn't matter, just needs filename
                data,
                'utf8'
            );

            // Check that a path was returned
            expect(path).toBeTruthy();
            expect(path).toContain(fileName);
        });
    });

    describe('createExportFileContent', () => {
        it('writes an unencrypted envelope at the current format version', async () => {
            const parsed = parse(await createExportFileContent(NODES, false));

            expect(parsed).toEqual({
                version: EXPORT_FORMAT_VERSION,
                encrypted: false,
                data: { nodes: NODES }
            });
        });

        it('writes a v2 scrypt + AES-256-GCM envelope when encrypting', async () => {
            const parsed = await exportEncrypted();

            expect(parsed.version).toBe(2);
            expect(parsed.encrypted).toBe(true);
            expect(parsed.cipher).toBe('aes-256-gcm');
            expect(parsed.kdf.name).toBe('scrypt');
            expect(parsed.kdf.N).toBe(16384);
            expect(parsed.kdf.dkLen).toBe(32);
            expect(Buffer.from(parsed.kdf.salt, 'base64')).toHaveLength(16);
            expect(Buffer.from(parsed.iv, 'base64')).toHaveLength(12);
            expect(Buffer.from(parsed.tag, 'base64')).toHaveLength(16);
        });

        it('never leaves credentials recoverable from the ciphertext', async () => {
            const content = await createExportFileContent(
                NODES,
                true,
                PASSWORD
            );

            expect(content).not.toContain('deadbeefcafe');
            expect(content).not.toContain('node.example.com');
            expect(content).not.toContain('abandon abandon abandon');
            expect(content).not.toContain(PASSWORD);
        });

        it('uses a fresh salt and IV on every export', async () => {
            const a = await exportEncrypted();
            const b = await exportEncrypted();

            expect(a.kdf.salt).not.toBe(b.kdf.salt);
            expect(a.iv).not.toBe(b.iv);
            expect(a.data).not.toBe(b.data);
        });

        it('reports progress and yields to the event loop while deriving', async () => {
            const progress: number[] = [];
            let ticks = 0;
            const interval = setInterval(() => {
                ticks += 1;
            }, 5);

            try {
                await createExportFileContent(NODES, true, PASSWORD, (p) =>
                    progress.push(p)
                );
            } finally {
                clearInterval(interval);
            }

            expect(progress.length).toBeGreaterThan(1);
            expect(Math.min(...progress)).toBeGreaterThanOrEqual(0);
            expect(Math.max(...progress)).toBeLessThanOrEqual(1);
            // A blocking derivation would starve the timer entirely.
            expect(ticks).toBeGreaterThan(0);
        });

        it('refuses to encrypt without a password rather than silently exporting plaintext', async () => {
            await expect(
                createExportFileContent(NODES, true, '')
            ).rejects.toThrow();
            await expect(
                createExportFileContent(NODES, true, undefined)
            ).rejects.toThrow();
        });
    });

    describe('decryptExportData - v2', () => {
        it('round-trips the node list', async () => {
            await expect(
                decryptExportData(await exportEncrypted(), PASSWORD)
            ).resolves.toEqual(NODES);
        });

        it('rejects a wrong password', async () => {
            await expect(
                decryptExportData(await exportEncrypted(), 'wrong password')
            ).rejects.toThrow(/wrong password or altered file/);
        });

        it('rejects a tampered ciphertext', async () => {
            const parsed = await exportEncrypted();

            const bytes = Buffer.from(parsed.data, 'base64');
            bytes[0] ^= 0xff;
            parsed.data = bytes.toString('base64');

            await expect(decryptExportData(parsed, PASSWORD)).rejects.toThrow(
                /wrong password or altered file/
            );
        });

        it('rejects a tampered authentication tag', async () => {
            const parsed = await exportEncrypted();

            const tag = Buffer.from(parsed.tag, 'base64');
            tag[0] ^= 0xff;
            parsed.tag = tag.toString('base64');

            await expect(decryptExportData(parsed, PASSWORD)).rejects.toThrow(
                /wrong password or altered file/
            );
        });

        it('rejects KDF parameters altered after export', async () => {
            const parsed = await exportEncrypted();

            parsed.kdf.r = 4;

            await expect(decryptExportData(parsed, PASSWORD)).rejects.toThrow();
        });

        it('rejects an out-of-range scrypt cost before deriving a key', async () => {
            const parsed = await exportEncrypted();

            parsed.kdf.N = 1 << 24;

            await expect(decryptExportData(parsed, PASSWORD)).rejects.toThrow(
                /Invalid key derivation parameters/
            );
        });

        it('rejects a non-power-of-two scrypt cost', async () => {
            const parsed = await exportEncrypted();

            parsed.kdf.N = 16383;

            await expect(decryptExportData(parsed, PASSWORD)).rejects.toThrow(
                /Invalid key derivation parameters/
            );
        });

        it('rejects an unknown KDF', async () => {
            const parsed = await exportEncrypted();

            parsed.kdf.name = 'pbkdf2';

            await expect(decryptExportData(parsed, PASSWORD)).rejects.toThrow(
                /Unsupported key derivation function/
            );
        });

        it('rejects an unknown cipher', async () => {
            const parsed = await exportEncrypted();

            parsed.cipher = 'aes-256-cbc';

            await expect(decryptExportData(parsed, PASSWORD)).rejects.toThrow(
                /Unsupported cipher/
            );
        });
    });

    describe('decryptExportData - v1 backward compatibility', () => {
        // Reproduces exactly what shipped v1 wrote: CryptoJS.AES.encrypt in
        // string-password mode over the { nodes } payload.
        const makeV1File = (
            nodes: Node[],
            password: string
        ): NodeConfigExport =>
            ({
                version: 1,
                encrypted: true,
                data: CryptoJS.AES.encrypt(
                    JSON.stringify({ nodes }),
                    password
                ).toString()
            } as NodeConfigExport);

        it('still imports a legacy v1 backup', async () => {
            await expect(
                decryptExportData(makeV1File(NODES, PASSWORD), PASSWORD)
            ).resolves.toEqual(NODES);
        });

        it('rejects a v1 backup with the wrong password', async () => {
            await expect(
                decryptExportData(makeV1File(NODES, PASSWORD), 'wrong password')
            ).rejects.toThrow();
        });
    });

    describe('decryptExportData - envelope guards', () => {
        it('refuses an unencrypted envelope', async () => {
            const parsed = parse(await createExportFileContent(NODES, false));

            await expect(decryptExportData(parsed, PASSWORD)).rejects.toThrow(
                /not encrypted/
            );
        });
    });
});
