// Bind react-native-biometrics keys to the biometrics enrolled when they were
// created, so a fingerprint or face added later cannot unlock Zeus
//
// Zeus unlocks with createSignature(), which only succeeds if the biometric
// prompt releases the private key made by createKeys(). That check is only
// as strict as the key's access control:
//
// - iOS: createKeys() uses kSecAccessControlBiometryAny, which accepts any
//   enrolled finger or face, including one added after the key was made.
//   kSecAccessControlBiometryCurrentSet makes the key unusable once the
//   enrolled set changes.
// - Android: setUserAuthenticationRequired(true) already defaults to
//   invalidating the key on new enrollment; this patch sets
//   setInvalidatedByBiometricEnrollment(true) explicitly, and makes
//   createSignature() reject with the code 'key_invalidated' when the key
//   was invalidated, so Zeus can tell that apart from other failures.
//
// Upstream: react-native-biometrics 3.0.1 (latest at time of writing).
//
// This patch is security-load-bearing: if an expected pattern is missing
// (e.g. after a dependency bump), it THROWS so postinstall fails loudly
// instead of shipping keys that accept newly enrolled biometrics.

import fs from 'fs';

const IOS_PATH =
    './node_modules/react-native-biometrics/ios/ReactNativeBiometrics.m';
const ANDROID_PATH =
    './node_modules/react-native-biometrics/android/src/main/java/com/rnbiometrics/ReactNativeBiometrics.java';

const PATCHES = [
    {
        path: IOS_PATH,
        name: 'createKeys access control',
        buggy: `SecAccessControlCreateFlags secCreateFlag = kSecAccessControlBiometryAny;`,
        fixed: `SecAccessControlCreateFlags secCreateFlag = kSecAccessControlBiometryCurrentSet;`
    },
    {
        path: ANDROID_PATH,
        name: 'createKeys enrollment invalidation',
        buggy: `                        .setUserAuthenticationRequired(true)
                        .build();`,
        fixed: `                        .setUserAuthenticationRequired(true)
                        .setInvalidatedByBiometricEnrollment(true)
                        .build();`
    },
    {
        path: ANDROID_PATH,
        name: 'createSignature invalidated key error code',
        buggy: `                                biometricPrompt.authenticate(getPromptInfo(promptMessage, cancelButtonText, allowDeviceCredentials), cryptoObject);
                            } catch (Exception e) {`,
        fixed: `                                biometricPrompt.authenticate(getPromptInfo(promptMessage, cancelButtonText, allowDeviceCredentials), cryptoObject);
                            } catch (android.security.keystore.KeyPermanentlyInvalidatedException e) {
                                promise.reject("key_invalidated", "Biometric key permanently invalidated");
                            } catch (Exception e) {`
    }
];

export function patchBiometricsEnrollment() {
    console.log('Patching react-native-biometrics enrollment binding');

    for (const { path, name, buggy, fixed } of PATCHES) {
        if (!fs.existsSync(path)) {
            throw new Error(
                `patch-biometrics-enrollment: ${path} not found; ` +
                    'the biometric enrollment fix cannot be applied'
            );
        }

        const content = fs.readFileSync(path, 'utf8');

        if (content.includes(fixed)) {
            console.log(`  - ${name}: already patched, skipping`);
            continue;
        }

        if (!content.includes(buggy)) {
            throw new Error(
                `patch-biometrics-enrollment: ${name} does not match the ` +
                    'expected pattern. react-native-biometrics may have ' +
                    'changed; verify whether biometric keys are still bound ' +
                    'to the enrolled set and update this patch before building.'
            );
        }

        fs.writeFileSync(path, content.replace(buggy, fixed));
        console.log(`  - ${name}: patched`);
    }
}
