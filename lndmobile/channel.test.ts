jest.mock('./utils', () => ({
    sendCommand: jest.fn()
}));

import { sendCommand } from './utils';
import {
    exportAllChannelBackups,
    restoreChannelBackups,
    verifyChanBackup
} from './channel';
import { lnrpc } from '../proto/lightning';

describe('channel', () => {
    const testBackupBase64 = 'dGVzdGJhY2t1cA==';

    describe('exportAllChannelBackups', () => {
        it('calls sendCommand with correct parameters', async () => {
            await exportAllChannelBackups();
            expect(sendCommand).toHaveBeenCalledWith({
                request: lnrpc.ChanBackupExportRequest,
                response: lnrpc.ChanBackupSnapshot,
                method: 'ExportAllChannelBackups',
                options: {}
            });
        });
    });

    describe('restoreChannelBackups', () => {
        it('calls sendCommand with correct parameters', async () => {
            await restoreChannelBackups(testBackupBase64);
            expect(sendCommand).toHaveBeenCalledWith({
                request: lnrpc.RestoreChanBackupRequest,
                response: lnrpc.RestoreBackupResponse,
                method: 'RestoreChannelBackups',
                options: {
                    multi_chan_backup: expect.any(Uint8Array)
                }
            });
        });
    });

    describe('verifyChanBackup', () => {
        it('calls sendCommand with correct parameters', async () => {
            await verifyChanBackup(testBackupBase64);
            expect(sendCommand).toHaveBeenCalledWith({
                request: lnrpc.ChanBackupSnapshot,
                response: lnrpc.VerifyChanBackupResponse,
                method: 'VerifyChanBackup',
                options: {
                    multi_chan_backup: {
                        multi_chan_backup: expect.any(Uint8Array)
                    }
                }
            });
        });
    });
});
