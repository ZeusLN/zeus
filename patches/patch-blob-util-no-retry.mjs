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
// OkHttp's own retryOnConnectionFailure is left on. It does not retry a
// timeout once the request has been sent.
//
// Upstream: react-native-blob-util 0.25.1 (latest at time of writing).
//
// Like the keychain patches this THROWS when the expected source is missing,
// so a dependency bump cannot silently bring the resend back.

import fs from 'fs';

export const MARKER = '// ZEUS PATCH: blob-util-no-retry';

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
                        if (e instanceof SocketException || e instanceof SocketTimeoutException) {
                            timeout = true;
                        }
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

const countOf = (content, needle) => content.split(needle).length - 1;

// Pure transform, exported for tests. Returns the patched source, or the
// input unchanged if it is already patched. Throws if the source does not
// match what this patch was written against.
export function applyBlobUtilNoRetry(content) {
    if (content.includes(MARKER)) {
        return content;
    }

    // the upstream file has CRLF line endings
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const original = ORIGINAL.replace(/\n/g, eol);

    if (countOf(content, original) !== 1) {
        throw new Error(
            'patch-blob-util-no-retry: the request interceptor in ' +
                'ReactNativeBlobUtilReq.java does not match the expected ' +
                'pattern. react-native-blob-util may have changed; verify ' +
                'whether it still resends a failed request and update this ' +
                'patch before building.'
        );
    }

    return content.replace(original, PATCHED.replace(/\n/g, eol));
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
    console.log('  - Patched ReactNativeBlobUtilReq.java request interceptor');
}
