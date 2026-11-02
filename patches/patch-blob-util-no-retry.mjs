// Stop react-native-blob-util from resending a request after it fails on Android
//
// ReactNativeBlobUtilReq.java adds an OkHttp application interceptor that
// catches any exception from chain.proceed(req), including the read timeout
// set from config({ timeout }), and then calls chain.proceed() again. The
// request goes out a second time with no sign of it in JS, which has already
// rejected with its own timeout. For a non-idempotent POST the server acts on
// it twice: on regtest an lnd SendCoins whose reply was held past the 30s
// REST timeout made two transactions to the same address (PR #4961), and
// LndHub /payinvoice is resent after 65s (issue #5238).
//
// This patch rethrows the failure so OkHttp reports it through onFailure, as
// it would without the interceptor. Exceptions that are not IOExceptions are
// wrapped in one, because OkHttp rethrows anything else on its dispatcher
// thread after calling onFailure, which would crash the app.
//
// OkHttp's own retry is limited to GET and HEAD. With
// retryOnConnectionFailure(true), OkHttp 4.x resends a request after an
// IOException other than a timeout (a connection reset, "unexpected end of
// stream") even once the request was sent, when the call used a pooled
// connection. blob-util shares one connection pool, so a POST the server
// received could go out again. GETs keep the retry, which hides stale
// pooled connections. Other methods also lose OkHttp's silent recovery
// from failures before the request was sent: falling back to the next IP
// or TLS spec after a connect failure, retrying an HTTP/2 refused stream,
// and reusing a pooled socket the server has just closed (OkHttp only
// checks non-GET sockets idle for 10s or more, so a server with a 5s
// keep-alive leaves a 5-10s window). Those now fail with an error the user
// sees, and the server never got the request. For a wallet that is better
// than a payment sent twice. Every CLNRest call is a POST, so its reads
// lose this recovery too.
//
// A 503 with Retry-After: 0 is resent by OkHttp whatever
// retryOnConnectionFailure says. The network interceptor drops Retry-After
// from 503 responses to methods other than GET and HEAD, so OkHttp does not
// follow up. Zeus does not read Retry-After. (OkHttp's 408 follow-up does
// check retryOnConnectionFailure. 421 and 307/308 follow-ups can resend a
// body, but they mean the server did not process the request.)
//
// This removes the resends above. It does not promise that a request reaches
// the server once: redirect follow-ups stay on, and a request that fails
// after the server acted on it still leaves the outcome unknown to the app
// (ZeusLN/zeus#5468).
//
// Upstream: react-native-blob-util 0.25.1 (latest at time of writing).
// Reported at https://github.com/RonRadtke/react-native-blob-util/issues/504.
// Fixed upstream in pull/505 (master, 1.1.0) and pull/506 (support/0.25);
// drop this patch once the release Zeus uses includes the fix.
//
// Like the keychain patches this THROWS when the expected source is missing,
// so a dependency bump cannot silently bring the resend back.

import fs from 'fs';

export const MARKER = '// ZEUS PATCH: blob-util-no-retry';
export const RETRY_MARKER = '// ZEUS PATCH: blob-util-no-connection-retry';
export const HTTP_RETRY_MARKER = '// ZEUS PATCH: blob-util-no-503-retry';

const REQ_PATH =
    './node_modules/react-native-blob-util/android/src/main/java/com/ReactNativeBlobUtil/ReactNativeBlobUtilReq.java';

const ORIGINAL = `                    } catch (SocketException e) {
                        timeout = true;
                        if (originalResponse != null) {
                            originalResponse.close();
                        }
                    } catch (SocketTimeoutException e) {
                        timeout = true;
                        if (originalResponse != null) {
                            originalResponse.close();
                        }
                        //ReactNativeBlobUtilUtils.emitWarningEvent("ReactNativeBlobUtil error when sending request : " + e.getLocalizedMessage());
                    } catch (Exception ex) {
                        if (originalResponse != null) {
                            originalResponse.close();
                        }
                    }

                    return chain.proceed(chain.request());
                }`;

const PATCHED = `                    } catch (IOException e) {
                        ${MARKER}
                        // Report the failure instead of sending the request
                        // again: the server may already have acted on it.
                        if (originalResponse != null) {
                            originalResponse.close();
                        }
                        throw e;
                    } catch (Exception ex) {
                        if (originalResponse != null) {
                            originalResponse.close();
                        }
                        throw new IOException(ex);
                    }
                }`;

const RETRY_ORIGINAL = `            clientBuilder.followSslRedirects(options.followRedirect);
            clientBuilder.retryOnConnectionFailure(true);`;

const RETRY_PATCHED = `            clientBuilder.followSslRedirects(options.followRedirect);
            ${RETRY_MARKER}
            // OkHttp may resend a request it already sent after a
            // connection failure; only allow that for idempotent methods
            clientBuilder.retryOnConnectionFailure("GET".equals(method) || "HEAD".equals(method));`;

const HTTP_RETRY_ORIGINAL = `                    redirects.add(chain.request().url().toString());
                    return chain.proceed(chain.request());`;

const HTTP_RETRY_PATCHED = `                    redirects.add(chain.request().url().toString());
                    ${HTTP_RETRY_MARKER}
                    // OkHttp resends a request after a 503 with Retry-After: 0
                    // even when connection failure retries are off; without
                    // the header it does not
                    Response response = chain.proceed(chain.request());
                    String requestMethod = chain.request().method();
                    if (response.code() == 503 && !("GET".equals(requestMethod) || "HEAD".equals(requestMethod))) {
                        return response.newBuilder().removeHeader("Retry-After").build();
                    }
                    return response;`;

const countOf = (content, needle) => content.split(needle).length - 1;

// Pure transform, exported for tests. Returns the patched source, or the
// input unchanged if it is already patched. Each edit is skipped when its
// marker is present, so a copy patched by an earlier version still gets the
// later edits. Throws if the source does not match what this patch was
// written against.
export function applyBlobUtilNoRetry(content) {
    // the upstream file has CRLF line endings
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const withEol = (text) => text.replace(/\n/g, eol);

    let patched = content;
    for (const [name, marker, original, replacement] of [
        ['the request interceptor', MARKER, ORIGINAL, PATCHED],
        [
            'the retryOnConnectionFailure(true) call',
            RETRY_MARKER,
            RETRY_ORIGINAL,
            RETRY_PATCHED
        ],
        [
            'the redirect network interceptor',
            HTTP_RETRY_MARKER,
            HTTP_RETRY_ORIGINAL,
            HTTP_RETRY_PATCHED
        ]
    ]) {
        if (patched.includes(marker)) continue;

        if (countOf(patched, withEol(original)) !== 1) {
            throw new Error(
                `patch-blob-util-no-retry: ${name} in ` +
                    'ReactNativeBlobUtilReq.java does not match the expected ' +
                    'pattern. react-native-blob-util may have changed; verify ' +
                    'whether it still resends a failed request and update ' +
                    'this patch before building.'
            );
        }
        patched = patched.replace(withEol(original), withEol(replacement));
    }

    return patched;
}

export function patchBlobUtilNoRetry() {
    console.log(
        'Patching react-native-blob-util to not resend failed requests'
    );

    if (!fs.existsSync(REQ_PATH)) {
        throw new Error(
            'patch-blob-util-no-retry: ReactNativeBlobUtilReq.java not ' +
                'found; the no-retry fix cannot be applied'
        );
    }

    const content = fs.readFileSync(REQ_PATH, 'utf8');
    const patched = applyBlobUtilNoRetry(content);

    if (patched === content) {
        console.log('  - Already patched, skipping');
        return;
    }

    fs.writeFileSync(REQ_PATH, patched);
    console.log(
        '  - Patched ReactNativeBlobUtilReq.java interceptors and retry'
    );
}
