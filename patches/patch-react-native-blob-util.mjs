// Add per-request TLS certificate pinning to react-native-blob-util.
//
// Zeus imports node credentials from connection strings that carry TLS
// certificate material (lndconnect `cert=`, clnrest `certs=`). This patch
// teaches the library a `pinnedCerts` config option (string[] of base64-DER
// certificates): when present, the connection is accepted only if a
// certificate in the presented chain byte-matches one of the pins, on both
// Android (OkHttp trust manager) and iOS (URLSession challenge handler).
// Pins take precedence over both CA validation and the `trusty` opt-out.
//
// Idempotent: files already carrying the ZEUS-PIN-PATCH marker are skipped.

import fs from 'fs';
import path from 'path';

const MARKER = 'ZEUS-PIN-PATCH';
const PKG = path.join('node_modules', 'react-native-blob-util');

const REPLACEMENTS = [
    {
        file: path.join(
            PKG,
            'android/src/main/java/com/ReactNativeBlobUtil/ReactNativeBlobUtilConfig.java'
        ),
        edits: [
            {
                anchor: '    public ReadableArray binaryContentTypes = null;',
                replacement:
                    '    public ReadableArray binaryContentTypes = null;\n' +
                    '    // ZEUS-PIN-PATCH\n' +
                    '    public ReadableArray pinnedCerts = null;'
            },
            {
                anchor:
                    '        if (options.hasKey("binaryContentTypes"))\n' +
                    '            this.binaryContentTypes = options.getArray("binaryContentTypes");',
                replacement:
                    '        if (options.hasKey("binaryContentTypes"))\n' +
                    '            this.binaryContentTypes = options.getArray("binaryContentTypes");\n' +
                    '        if (options.hasKey("pinnedCerts"))\n' +
                    '            this.pinnedCerts = options.getArray("pinnedCerts");'
            }
        ]
    },
    {
        file: path.join(
            PKG,
            'android/src/main/java/com/ReactNativeBlobUtil/ReactNativeBlobUtilReq.java'
        ),
        edits: [
            {
                anchor:
                    '            // use trusty SSL socket\n' +
                    '            if (this.options.trusty) {',
                replacement:
                    '            // ZEUS-PIN-PATCH: pinned certs take precedence over trusty\n' +
                    '            if (this.options.pinnedCerts != null && this.options.pinnedCerts.size() > 0) {\n' +
                    '                clientBuilder = ReactNativeBlobUtilUtils.getPinnedOkHttpClient(client, this.options.pinnedCerts);\n' +
                    '            } else if (this.options.trusty) {'
            }
        ]
    },
    {
        file: path.join(
            PKG,
            'android/src/main/java/com/ReactNativeBlobUtil/ReactNativeBlobUtilUtils.java'
        ),
        edits: [
            {
                anchor:
                    '    public static OkHttpClient.Builder getUnsafeOkHttpClient(OkHttpClient client) {',
                replacement:
                    `    // ZEUS-PIN-PATCH: certificate pinning support.
    // Accepts the connection iff any certificate in the presented chain
    // byte-matches one of the pinned base64-DER certificates. The pin
    // authenticates the endpoint, so hostname verification is skipped
    // (self-signed node certs routinely lack matching SANs).
    public static OkHttpClient.Builder getPinnedOkHttpClient(OkHttpClient client, final com.facebook.react.bridge.ReadableArray pinnedCerts) {
        try {
            final java.util.List<byte[]> pins = new java.util.ArrayList<>();
            for (int i = 0; i < pinnedCerts.size(); i++) {
                final String b64 = pinnedCerts.getString(i);
                if (b64 == null) continue;
                final byte[] der = Base64.decode(b64, Base64.DEFAULT);
                if (der != null && der.length > 0) pins.add(der);
            }
            if (pins.isEmpty()) throw new IllegalStateException("pinnedCerts set but none decodable");

            final X509TrustManager pinTrustManager = new X509TrustManager() {
                @Override
                public void checkClientTrusted(java.security.cert.X509Certificate[] chain, String authType) {}

                @Override
                public void checkServerTrusted(java.security.cert.X509Certificate[] chain, String authType) throws java.security.cert.CertificateException {
                    for (java.security.cert.X509Certificate cert : chain) {
                        try {
                            final byte[] der = cert.getEncoded();
                            for (byte[] pin : pins) {
                                if (java.util.Arrays.equals(der, pin)) return;
                            }
                        } catch (java.security.cert.CertificateEncodingException ignored) {}
                    }
                    throw new java.security.cert.CertificateException("certificate pinning failure");
                }

                @Override
                public java.security.cert.X509Certificate[] getAcceptedIssuers() {
                    return new java.security.cert.X509Certificate[0];
                }
            };

            final SSLContext sslContext = SSLContext.getInstance("SSL");
            sslContext.init(null, new TrustManager[]{ pinTrustManager }, new java.security.SecureRandom());
            final SSLSocketFactory sslSocketFactory = sslContext.getSocketFactory();

            OkHttpClient.Builder builder = client.newBuilder();
            builder.sslSocketFactory(sslSocketFactory, pinTrustManager);
            builder.hostnameVerifier(new HostnameVerifier() {
                @Override
                public boolean verify(String hostname, SSLSession session) {
                    return true;
                }
            });

            return builder;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public static OkHttpClient.Builder getUnsafeOkHttpClient(OkHttpClient client) {`
            }
        ]
    },
    {
        file: path.join(PKG, 'ios/ReactNativeBlobUtilRequest.mm'),
        edits: [
            {
                anchor:
                    '- (void) URLSession:(NSURLSession *)session didReceiveChallenge:(NSURLAuthenticationChallenge *)challenge completionHandler:(void (^)(NSURLSessionAuthChallengeDisposition, NSURLCredential * _Nullable credantial))completionHandler\n' +
                    '{\n' +
                    '    if ([[options valueForKey:CONFIG_TRUSTY] boolValue]) {',
                replacement:
                    `- (void) URLSession:(NSURLSession *)session didReceiveChallenge:(NSURLAuthenticationChallenge *)challenge completionHandler:(void (^)(NSURLSessionAuthChallengeDisposition, NSURLCredential * _Nullable credantial))completionHandler
{
    // ZEUS-PIN-PATCH: certificate pinning — accept iff any presented
    // certificate byte-matches a pinned base64-DER certificate
    NSArray *zeusPinnedCerts = [options valueForKey:@"pinnedCerts"];
    if ([zeusPinnedCerts isKindOfClass:[NSArray class]] && [zeusPinnedCerts count] > 0) {
        BOOL zeusPinMatched = NO;
        SecTrustRef zeusServerTrust = challenge.protectionSpace.serverTrust;
        CFArrayRef zeusChain = SecTrustCopyCertificateChain(zeusServerTrust);
        if (zeusChain != NULL) {
            for (id zeusCertObj in (__bridge NSArray *)zeusChain) {
                NSData *zeusDer = (__bridge_transfer NSData *)SecCertificateCopyData((__bridge SecCertificateRef)zeusCertObj);
                for (id zeusPinObj in zeusPinnedCerts) {
                    if (![zeusPinObj isKindOfClass:[NSString class]]) continue;
                    NSData *zeusPinDer = [[NSData alloc] initWithBase64EncodedString:(NSString *)zeusPinObj options:0];
                    if (zeusPinDer != nil && [zeusDer isEqualToData:zeusPinDer]) {
                        zeusPinMatched = YES;
                        break;
                    }
                }
                if (zeusPinMatched) break;
            }
            CFRelease(zeusChain);
        }
        if (zeusPinMatched) {
            completionHandler(NSURLSessionAuthChallengeUseCredential, [NSURLCredential credentialForTrust:zeusServerTrust]);
        } else {
            completionHandler(NSURLSessionAuthChallengeCancelAuthenticationChallenge, nil);
        }
        return;
    }
    if ([[options valueForKey:CONFIG_TRUSTY] boolValue]) {`
            }
        ]
    },
    {
        file: path.join(PKG, 'index.d.ts'),
        edits: [
            {
                anchor:
                    '    /**\n' +
                    '     * Set this property to true will allow the request create connection with server have self-signed SSL\n' +
                    '     * certification. This is not recommended to use in production.\n' +
                    '     */\n' +
                    '    trusty?: boolean;',
                replacement:
                    '    /**\n' +
                    '     * Set this property to true will allow the request create connection with server have self-signed SSL\n' +
                    '     * certification. This is not recommended to use in production.\n' +
                    '     */\n' +
                    '    trusty?: boolean;\n' +
                    '\n' +
                    '    /**\n' +
                    '     * ZEUS-PIN-PATCH: base64-DER TLS certificates to pin against. When set, the\n' +
                    '     * connection is accepted only if a presented certificate byte-matches a pin.\n' +
                    '     */\n' +
                    '    pinnedCerts?: string[];'
            }
        ]
    }
];

export function patchReactNativeBlobUtil() {
    console.log(
        'Patching react-native-blob-util (add pinnedCerts TLS pinning)'
    );

    for (const { file, edits } of REPLACEMENTS) {
        if (!fs.existsSync(file)) {
            console.warn(`  - Skip ${file}: not found`);
            continue;
        }

        let content = fs.readFileSync(file, 'utf8');
        if (content.includes(MARKER)) {
            console.log(`  - Already patched ${file}`);
            continue;
        }

        // The published package ships CRLF line endings — match the file
        const crlf = content.includes('\r\n');
        const toFileEOL = (s) => (crlf ? s.replace(/\n/g, '\r\n') : s);

        let applied = 0;
        for (const { anchor, replacement } of edits) {
            const fileAnchor = toFileEOL(anchor);
            if (!content.includes(fileAnchor)) {
                console.warn(
                    `  - WARNING ${file}: patch anchor not found — pinning NOT applied. ` +
                        'The react-native-blob-util sources have changed; update patches/patch-react-native-blob-util.mjs.'
                );
                continue;
            }
            content = content.replace(fileAnchor, toFileEOL(replacement));
            applied++;
        }

        if (applied > 0) {
            fs.writeFileSync(file, content, 'utf8');
            console.log(`  - Patched ${file} (${applied}/${edits.length} edits)`);
        }
    }
}
