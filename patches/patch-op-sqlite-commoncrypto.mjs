// Build op-sqlite's SQLCipher with Apple's CommonCrypto on iOS (#4471)
//
// op-sqlite's podspec compiles SQLCipher with its default crypto provider,
// OpenSSL, and depends on the OpenSSL-Universal pod for it. But in ZEUS the
// app binary also links react-native-nitro-tor's prebuilt static library,
// which carries its own OpenSSL (3.5.4 in nitro-tor 0.6.1). SQLCipher is
// compiled into the same binary, so its OpenSSL calls bind to Tor's copy at
// link time and the embedded OpenSSL.framework is never used:
// PRAGMA cipher_provider_version reports Tor's OpenSSL, not the pod's.
//
// This patch selects SQLCipher's CommonCrypto provider instead
// (SQLCIPHER_CRYPTO_CC, part of the same amalgamation) and drops the
// OpenSSL-Universal dependency. SQLCipher's file format does not depend on
// the provider: a database written with OpenSSL opens with CommonCrypto.
//
// NDEBUG=1 is needed with it: under Xcode's Clang modules, the
// CommonCrypto/CoreFoundation includes re-export an active assert() after
// SQLite has disabled it, and asserts that reference SQLITE_DEBUG-only
// fields fail to compile. SQLite's release builds define NDEBUG anyway.
//
// Android is unchanged: op-sqlite links its own libcrypto there, built by
// ZeusLN/openssl-android (android/build.gradle).
//
// Like the other patches this THROWS when the expected source is missing, so
// an op-sqlite bump cannot silently bring the OpenSSL dependency back.

import fs from 'fs';

export const MARKER = '# ZEUS PATCH: op-sqlite-commoncrypto';

const PODSPEC_PATH =
    './node_modules/@op-engineering/op-sqlite/op-sqlite.podspec';

// Whole lines, so a changed dependency line (a version constraint, say)
// does not match
const ORIGINAL = `SQLITE_EXTRA_SHUTDOWN=sqlcipher_extra_shutdown"
    s.dependency "OpenSSL-Universal"
`;

const PATCHED = `SQLITE_EXTRA_SHUTDOWN=sqlcipher_extra_shutdown"
    ${MARKER}: CommonCrypto instead of OpenSSL, see patches/patch-op-sqlite-commoncrypto.mjs
    xcconfig[:GCC_PREPROCESSOR_DEFINITIONS] += " SQLCIPHER_CRYPTO_CC NDEBUG=1"
    s.ios.frameworks = "Security"
`;

const countOf = (content, needle) => content.split(needle).length - 1;

// Pure transform, exported for tests. Returns the patched source, or the
// input unchanged if it is already patched. Throws if the source does not
// match what this patch was written against.
export function applyOpSqliteCommonCrypto(content) {
    if (content.includes(MARKER)) {
        return content;
    }

    if (countOf(content, ORIGINAL) !== 1) {
        throw new Error(
            'patch-op-sqlite-commoncrypto: the SQLCipher block in ' +
                'op-sqlite.podspec does not match the expected pattern. ' +
                'op-sqlite may have changed; check how it selects the ' +
                'SQLCipher crypto provider on iOS and update this patch ' +
                'before building.'
        );
    }

    return content.replace(ORIGINAL, PATCHED);
}

export function patchOpSqliteCommonCrypto() {
    console.log(
        'Patching op-sqlite to build SQLCipher with CommonCrypto on iOS'
    );

    if (!fs.existsSync(PODSPEC_PATH)) {
        throw new Error(
            'patch-op-sqlite-commoncrypto: op-sqlite.podspec not found; ' +
                'the CommonCrypto change cannot be applied'
        );
    }

    const content = fs.readFileSync(PODSPEC_PATH, 'utf8');
    const patched = applyOpSqliteCommonCrypto(content);

    if (patched === content) {
        console.log('  - Already patched, skipping');
        return;
    }

    fs.writeFileSync(PODSPEC_PATH, patched);
    console.log('  - Patched op-sqlite.podspec');
}
