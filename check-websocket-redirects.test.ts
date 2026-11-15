import * as fs from 'fs';

// OkHttp follows redirects on the WebSocket handshake by default and drops
// only the Authorization header on a cross-host hop, so the LND streams'
// Grpc-Metadata-Macaroon header would reach the redirect target. The Android
// app turns redirects off for React Native's WebSocket client in
// MainApplication.kt; this check keeps that from being removed unnoticed.
const MAIN_APPLICATION =
    'android/app/src/main/java/com/zeus/MainApplication.kt';

const withoutComments = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('Android WebSocket client', () => {
    const source = withoutComments(
        fs.readFileSync(MAIN_APPLICATION).toString('utf8')
    );
    const builder = source.match(
        /WebSocketModule\.setCustomClientBuilder\s*\{([\s\S]*?)\}/
    );

    it('installs a custom client builder', () => {
        expect(builder).not.toBeNull();
    });

    it('does not follow redirects', () => {
        expect(builder?.[1]).toMatch(/\.followRedirects\(false\)/);
        expect(builder?.[1]).toMatch(/\.followSslRedirects\(false\)/);
    });
});
