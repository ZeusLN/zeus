// Add per-request TLS certificate pinning to react-native-blob-util.
//
// Zeus imports node credentials from connection strings that carry TLS
// certificate material (lndconnect `cert=`, clnrest `certs=`). This patch
// teaches the library a `pinnedCerts` config option (string[] of base64-DER
// certificates). When present, the pinned certificates act as the ONLY
// trust anchors: the connection is accepted iff the presented chain
// validates against them (PKIX on Android OkHttp, SecTrust anchor
// evaluation on iOS). A self-signed node cert validates as its own anchor
// (lndconnect); a CA-issued leaf validates against a pinned CA (clnrest).
// Byte-matching alone is NOT sufficient and is not used: an active MITM
// could otherwise slip the (public) pinned cert into an attacker-controlled
// chain. Pins take precedence over both CA validation and the `trusty`
// opt-out.
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
                    `    // ZEUS-PIN-PATCH: certificate pinning via trust anchors.
    // The pinned certificates are loaded as the ONLY anchors of an
    // in-memory KeyStore and the presented chain is validated against
    // them with PKIX. A self-signed node cert validates as its own
    // anchor (lndconnect); a CA-issued leaf validates against a pinned
    // CA (clnrest); an attacker chain that merely carries a pinned
    // (public) cert alongside their own leaf FAILS, because the
    // attacker leaf is not signed by any anchor.
    public static OkHttpClient.Builder getPinnedOkHttpClient(OkHttpClient client, final com.facebook.react.bridge.ReadableArray pinnedCerts) {
        try {
            final java.security.KeyStore pinStore = java.security.KeyStore.getInstance(java.security.KeyStore.getDefaultType());
            pinStore.load(null, null);
            final java.security.cert.CertificateFactory certFactory = java.security.cert.CertificateFactory.getInstance("X.509");
            int pinCount = 0;
            for (int i = 0; i < pinnedCerts.size(); i++) {
                final String b64 = pinnedCerts.getString(i);
                if (b64 == null) continue;
                final byte[] der = Base64.decode(b64, Base64.DEFAULT);
                if (der == null || der.length == 0) continue;
                pinStore.setCertificateEntry(
                    "zeus-pin-" + pinCount++,
                    certFactory.generateCertificate(new java.io.ByteArrayInputStream(der))
                );
            }
            if (pinCount == 0) throw new IllegalStateException("pinnedCerts set but none decodable");

            final javax.net.ssl.TrustManagerFactory tmf = javax.net.ssl.TrustManagerFactory.getInstance(javax.net.ssl.TrustManagerFactory.getDefaultAlgorithm());
            tmf.init(pinStore);
            final X509TrustManager anchorTrustManager = (X509TrustManager) tmf.getTrustManagers()[0];

            final SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, new TrustManager[]{ anchorTrustManager }, new java.security.SecureRandom());
            final SSLSocketFactory sslSocketFactory = sslContext.getSocketFactory();

            OkHttpClient.Builder builder = client.newBuilder();
            builder.sslSocketFactory(sslSocketFactory, anchorTrustManager);
            // the anchor authenticates the endpoint; self-signed node
            // certs routinely lack matching SANs, so skip hostname
            // verification
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
    // ZEUS-PIN-PATCH: certificate pinning via trust anchors. The pinned
    // certificates become the ONLY anchors for this evaluation and the
    // presented chain must validate against them — a self-signed node
    // cert validates as its own anchor (lndconnect), a CA-issued leaf
    // validates against a pinned CA (clnrest), and an attacker chain
    // merely carrying a pinned (public) cert fails, because the
    // attacker leaf is not signed by any anchor. Only server-trust
    // challenges are handled here; everything else falls through to the
    // default paths below.
    NSArray *zeusPinnedCerts = [options valueForKey:@"pinnedCerts"];
    if ([challenge.protectionSpace.authenticationMethod isEqualToString:NSURLAuthenticationMethodServerTrust] &&
        [zeusPinnedCerts isKindOfClass:[NSArray class]] && [zeusPinnedCerts count] > 0) {
        SecTrustRef zeusServerTrust = challenge.protectionSpace.serverTrust;
        NSMutableArray *zeusAnchors = [NSMutableArray array];
        for (id zeusPinObj in zeusPinnedCerts) {
            if (![zeusPinObj isKindOfClass:[NSString class]]) continue;
            NSData *zeusPinDer = [[NSData alloc] initWithBase64EncodedString:(NSString *)zeusPinObj options:0];
            if (zeusPinDer == nil) continue;
            SecCertificateRef zeusAnchor = SecCertificateCreateWithData(NULL, (__bridge CFDataRef)zeusPinDer);
            if (zeusAnchor != NULL) {
                [zeusAnchors addObject:(__bridge id)zeusAnchor];
                CFRelease(zeusAnchor);
            }
        }
        BOOL zeusTrusted = NO;
        if ([zeusAnchors count] > 0 && zeusServerTrust != NULL) {
            SecTrustSetAnchorCertificates(zeusServerTrust, (__bridge CFArrayRef)zeusAnchors);
            SecTrustSetAnchorCertificatesOnly(zeusServerTrust, true);
            // Mirror the Android side: the trust object for a server-trust
            // challenge carries an SSL policy that enforces hostname
            // matching even with custom anchors, but self-signed node
            // certs routinely lack SANs matching the dialed address.
            // The anchors authenticate the endpoint, so evaluate against
            // a plain X509 policy instead.
            SecPolicyRef zeusPolicy = SecPolicyCreateBasicX509();
            SecTrustSetPolicies(zeusServerTrust, (__bridge CFArrayRef)@[ (__bridge id)zeusPolicy ]);
            CFRelease(zeusPolicy);
            CFErrorRef zeusError = NULL;
            zeusTrusted = SecTrustEvaluateWithError(zeusServerTrust, &zeusError);
            if (zeusError != NULL) CFRelease(zeusError);
        }
        if (zeusTrusted) {
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
                    '     * ZEUS-PIN-PATCH: base64-DER TLS certificates used as the only trust\n' +
                    '     * anchors. When set, the presented chain must validate against a pin.\n' +
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

        // All-or-nothing per file: this is a security patch, so a missed
        // anchor must fail the install loudly rather than ship a client
        // that silently lacks pinning (a partially-applied file would also
        // carry the marker and never self-heal on later runs).
        let rewritten = content;
        for (const { anchor, replacement } of edits) {
            const fileAnchor = toFileEOL(anchor);
            if (!rewritten.includes(fileAnchor)) {
                throw new Error(
                    `react-native-blob-util patch anchor not found in ${file} — ` +
                        'pinning NOT applied. The library sources have changed; ' +
                        'update patches/patch-react-native-blob-util.mjs.'
                );
            }
            rewritten = rewritten.replace(fileAnchor, toFileEOL(replacement));
        }

        fs.writeFileSync(file, rewritten, 'utf8');
        console.log(`  - Patched ${file} (${edits.length}/${edits.length} edits)`);
    }
}
