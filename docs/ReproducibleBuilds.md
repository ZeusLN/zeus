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

## Signing APKs

1. Install signing utilities: `apt-get install -y apksigner`
2. Create your certificate, if you haven't done so already. If you already have the certificate from previous builds, it's advised that you use the same one so you are able to upgrade from one APK to the next one without reinstalling first: `keytool -genkeypair -alias zeus -keystore zeus.pfx -v -storetype PKCS12 -keyalg RSA -keysize 2048 -storepass your_keystore_password -keypass your_key_password -validity 10000 -dname "cn=Unknown, ou=Unknown, o=Unknown, c=Unknown"`
3. Sign the chosen APK file using this command: `java -jar /usr/bin/apksigner sign -v --ks zeus.pfx --ks-key-alias zeus --ks-pass pass:your_keystore_password --key-pass pass:your_key_password zeus-universal.apk`
4. Copy the signed APK to your smartphone and install it by tapping over the file. If you get an error, you'll have to uninstall your currently installed version of ZEUS first. Note that you'll lose your connections and you'll need to reconfigure ZEUS again to connect to your node.