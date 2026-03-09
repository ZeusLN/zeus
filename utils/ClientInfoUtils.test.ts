import { getClientInfo, stripVersionPrefix } from './ClientInfoUtils';
import { version as appVersion } from '../package.json';

const strippedAppVersion = appVersion.replace(/^[vV]/, '');

describe('ClientInfoUtils', () => {
    describe('stripVersionPrefix', () => {
        it('strips lowercase v prefix', () => {
            expect(stripVersionPrefix('v0.18.4-beta')).toBe('0.18.4-beta');
        });

        it('strips uppercase V prefix', () => {
            expect(stripVersionPrefix('V25.02')).toBe('25.02');
        });

        it('leaves version without prefix unchanged', () => {
            expect(stripVersionPrefix('0.13.0-prealpha')).toBe(
                '0.13.0-prealpha'
            );
        });

        it('only strips the first v', () => {
            expect(stripVersionPrefix('v1.2.3-v4')).toBe('1.2.3-v4');
        });

        it('handles empty string', () => {
            expect(stripVersionPrefix('')).toBe('');
        });

        it('does not strip v from middle of string', () => {
            expect(stripVersionPrefix('24.11-preview')).toBe('24.11-preview');
        });
    });

    describe('getClientInfo', () => {
        it('always includes app name and version without v prefix', () => {
            const info = getClientInfo();
            expect(info.app).toBe('ZEUS');
            expect(info.app_version).toBe(strippedAppVersion);
            expect(info.app_version).not.toMatch(/^[vV]/);
        });

        it('omits node fields when no implementation provided', () => {
            const info = getClientInfo();
            expect(info.node).toBeUndefined();
            expect(info.node_version).toBeUndefined();
        });

        it('maps embedded-lnd to LND', () => {
            const info = getClientInfo('embedded-lnd', '0.18.4-beta');
            expect(info.node).toBe('LND');
            expect(info.node_version).toBe('0.18.4-beta');
        });

        it('maps lnd to LND', () => {
            const info = getClientInfo('lnd', '0.17.0-beta');
            expect(info.node).toBe('LND');
            expect(info.node_version).toBe('0.17.0-beta');
        });

        it('maps lightning-node-connect to LND', () => {
            const info = getClientInfo('lightning-node-connect', '0.18.0');
            expect(info.node).toBe('LND');
            expect(info.node_version).toBe('0.18.0');
        });

        it('maps cln-rest to Core Lightning', () => {
            const info = getClientInfo('cln-rest', '25.02');
            expect(info.node).toBe('Core Lightning');
            expect(info.node_version).toBe('25.02');
        });

        it('includes node name but omits node_version when version not provided', () => {
            const info = getClientInfo('embedded-lnd');
            expect(info.node).toBe('LND');
            expect(info.node_version).toBeUndefined();
        });

        it('uses implementation string as fallback for unknown backends', () => {
            const info = getClientInfo('ldk-node' as any, '0.5.0');
            expect(info.node).toBe('ldk-node');
            expect(info.node_version).toBe('0.5.0');
        });

        it('ignores node_version when no implementation provided', () => {
            const info = getClientInfo(undefined, '0.18.4-beta');
            expect(info.node).toBeUndefined();
            expect(info.node_version).toBeUndefined();
        });

        it('strips v prefix from node version', () => {
            const info = getClientInfo('cln-rest', 'v24.11.1');
            expect(info.node_version).toBe('24.11.1');
        });

        it('strips V prefix from node version', () => {
            const info = getClientInfo('lnd', 'V0.18.4-beta');
            expect(info.node_version).toBe('0.18.4-beta');
        });

        it('returns correct shape for LSPS1 REST payload', () => {
            const info = getClientInfo('lnd', '0.18.4-beta');
            const payload = {
                lsp_balance_sat: '5000000',
                client_balance_sat: '0',
                token: 'SUMMER25',
                client_info: info
            };
            expect(payload.client_info).toEqual({
                app: 'ZEUS',
                app_version: strippedAppVersion,
                node: 'LND',
                node_version: '0.18.4-beta'
            });
        });

        it('returns correct shape for LSPS7 custom message payload', () => {
            const info = getClientInfo('embedded-lnd', '0.18.4-beta');
            const params = {
                short_channel_id: '832746x1x0',
                channel_extension_expiry_blocks: 4380,
                token: '',
                client_info: info
            };
            expect(params.client_info.app).toBe('ZEUS');
            expect(params.client_info.node).toBe('LND');
        });

        it('returns correct shape for Flow proposal payload', () => {
            const info = getClientInfo('embedded-lnd', '0.18.4-beta');
            const body = {
                bolt11: 'lnbc1...',
                fee_id: 'abc123',
                simpleTaproot: false,
                client_info: info
            };
            expect(body.client_info).toEqual({
                app: 'ZEUS',
                app_version: strippedAppVersion,
                node: 'LND',
                node_version: '0.18.4-beta'
            });
        });

        it('handles cln-rest for LSPS1 REST with v prefix stripped', () => {
            const info = getClientInfo('cln-rest', 'v24.11.1');
            const payload = {
                lsp_balance_sat: '1000000',
                client_info: info
            };
            expect(payload.client_info.node).toBe('Core Lightning');
            expect(payload.client_info.node_version).toBe('24.11.1');
        });
    });
});
