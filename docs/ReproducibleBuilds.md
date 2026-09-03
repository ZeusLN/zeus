# Reproducible builds

Reproducible builds are available for Android only right now. You'll need Docker installed to be able to build the app this way:

1. Clone ZEUS git for the branch/tag that you want to build. For example: `git clone --depth 1 --branch v0.8.0 https://github.com/ZeusLN/zeus.git`
    You can also remove the `--branch v0.8.0` parameter to build APKs for `master`.
2. Change to the zeus directory: `cd zeus`
3. Execute the build script: `./build.sh`
4. If everything goes well, the script will print a list of all the generated APK files and SHA256 hashes for each one of them: armv7, armv8, x86, x86_64, universal. The equivalent to the one provided in the web page is the one ending in 'universal'. You can compare SHA256 hashes with the ones provided on the [GitHub releases page](https://github.com/ZeusLN/zeus/releases)
5. Download the official APK from [GitHub releases page](https://github.com/ZeusLN/zeus/releases) or from the [ZEUS homepage](https://zeusln.com/): `wget https://zeusln.com/zeus-v0.8.0-universal.apk`
6. Compare both APKs with a suitable utility like `diffoscope`, `apksigcopier` or by running `diff --brief --recursive ./unpacked_oficial_apk ./unpacked_built_apk`. You should only get differences for the certificates used to sign the official APK

If you want to install the APK built this way onto your own smartphone, you'll need to sign it yourself (see next section). Note that the first time you install a build made using this procedure, you'll need to uninstall your current version of ZEUS and then install the one built here because certificates will not match. You'll lose your connection details and you'll need to reconfigure ZEUS again to connect to your nodes.

## What is pinned

A rebuild only matches byte for byte if every input is fixed. ZEUS pins them at every layer:

- **Builder image** — `build.sh` references `reactnativecommunity/react-native-android` by digest, not by tag, so the JDK, SDK and NDK inside it cannot move.
- **Timestamps** — `SOURCE_DATE_EPOCH` is exported into the container (default `0`).
- **npm dependencies** — every entry in `package.json` is an exact version, and `yarn.lock` records an exact version, tarball URL and integrity hash for each resolved package. `build.sh` installs with `--frozen-lockfile`, so a lockfile that does not match `package.json` fails the build instead of silently re-resolving.
- **Native libraries** — the embedded LND, LDK Node, CDK and Cashu restore binaries are fetched by `fetch-libraries.sh` and checked against the SHA256 hashes in `fetch-libraries-versions.json`.
- **Gradle** — the wrapper verifies the Gradle distribution against `distributionSha256Sum`, and dependency locking pins the Maven graph (see below).

Note that the `yarn.lock` files under `zeus_modules/` are not build inputs. Those modules are vendored with their `dist/` output committed to git, so they are pinned by the repository itself; their lockfiles only matter to someone regenerating that output.

## Gradle dependency locking

Direct Maven coordinates are written out in the `build.gradle` files, but their *transitive* closure is resolved at build time and was previously free to drift — Gradle picks the highest version among conflicting requests, so a new release of a transitive dependency could change what a rebuild produced. Dependency locking records the resolved graph so it cannot.

Two lock files are kept:

- `android/gradle.lockfile` — the buildscript classpath (Android Gradle Plugin, Kotlin plugin, React Native Gradle plugin). Several of these are declared without a version, so the lock file is the only record of what was used.
- `android/app/gradle.lockfile` — `releaseRuntimeClasspath` and `releaseCompileClasspath`, which together determine what ends up in the APK. `:app` resolves the full closure, including the external dependencies contributed by `:lndmobile` and the autolinked React Native libraries.

To regenerate them after changing an Android dependency, run the build with `--write-locks` and commit the result:

```
./build.sh --write-locks
git diff --stat android/gradle.lockfile android/app/gradle.lockfile
```

Locks are generated inside the pinned builder image on purpose, so the recorded graph matches the toolchain that actually builds releases rather than whatever a contributor has installed locally.

A changed lock file in a pull request is a meaningful review signal: it means the Maven graph moved, and the diff shows exactly which coordinates changed.

## Signing APKs

1. Install signing utilities: `apt-get install -y apksigner`
2. Create your certificate, if you haven't done so already. If you already have the certificate from previous builds, it's advised that you use the same one so you are able to upgrade from one APK to the next one without reinstalling first: `keytool -genkeypair -alias zeus -keystore zeus.pfx -v -storetype PKCS12 -keyalg RSA -keysize 2048 -storepass your_keystore_password -keypass your_key_password -validity 10000 -dname "cn=Unknown, ou=Unknown, o=Unknown, c=Unknown"`
3. Sign the chosen APK file using this command: `java -jar /usr/bin/apksigner sign -v --ks zeus.pfx --ks-key-alias zeus --ks-pass pass:your_keystore_password --key-pass pass:your_key_password zeus-universal.apk`
4. Copy the signed APK to your smartphone and install it by tapping over the file. If you get an error, you'll have to uninstall your currently installed version of ZEUS first. Note that you'll lose your connections and you'll need to reconfigure ZEUS again to connect to your node.