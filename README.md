# Zeus
<p align="center"><img src="https://user-images.githubusercontent.com/1878621/208786339-ac5f64e3-d419-404c-9293-dd2301795891.png"></p>

Zeus is a mobile Bitcoin/Lightning node manager and wallet application for LND, Core Lightning, and Eclair. ⚡️

Zeus is built on TypeScript and React Native. It runs on both iOS and Android.

Read more on our [documentation site](https://docs.zeusln.app/).

### App Store links
* [Google Play](https://play.google.com/store/apps/details?id=app.zeusln.zeus)
* [Apple App Store](https://apps.apple.com/us/app/zeus-ln/id1456038895)
* [F-Droid](https://zeusln.app/download)

### Get in touch with us
* Come chat with us on
[Telegram](https://t.me/zeusLN)
* Join our
[developer Slack](https://zeusln.slack.com/join/shared_invite/zt-qw205nqa-o4VJJC0zPI7HiSfToZGoVw#/)
* Keep up with us on
[Twitter](https://twitter.com/ZeusLN)
and
[Nostr](https://iris.to/#/profile/npub1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5)
* Open a channel with
[our node](https://amboss.space/node/031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581)

## Features

- [x] Bitcoin only wallet
- [x] Non-custodial
- [x] No processing fees
- [x] No KYC
- [x] Fully open source (APGLv3)
- [x] Connect to LND, Core Lightning (REST + Sparko), or Eclair lightning node
- [x] Manage multiple lightning nodes at once
- [x] Connect via LNDHub instances
- [x] Lightning accounts
- [x] On-chain accounts
- [x] Easy to use activity menu
- [x] NFC payments and requests
- [x] PIN or passphrase encryption
- [x] Connect over Tor
- [x] Privacy mode - hide your sensitive data
- [x] Lightning address send
- [x] Full LNURL support (pay, withdraw, auth, channel)
- [x] Lightning channel management
- [x] Detailed routing reports
- [x] Set and manage routing fees
- [x] MPP/AMP support
- [x] Keysend support
- [x] SegWit support 
- [x] Sign & verify messages
- [x] Fiat currency integrations
- [x] [Various language support](https://app.transifex.com/ZeusLN/zeus/)
- [x] Multi-theme
- [x] On-chain coin control 
- [ ] External signer support
- [ ] Watch-only accounts
- [x] Contact list for easier payments
- [ ] Multiple profile types (payments, merchant etc.)
- [x] Lightning address receive
- [x] Taproot support 
- [ ] Connect a watchtower
- [ ] Advanced security center
- [ ] Notifications 
- [ ] Batch on-chain transactions
- [ ] Batch channel opens
- [ ] PayJoin
- [x] [Lightning Node Connect](https://docs.lightning.engineering/lightning-network-tools/lightning-terminal/lightning-node-connect)

## Connecting Zeus to your node

Currently, to use Zeus, you must have a Bitcoin Lightning node running [Lightning Network Daemon (lnd)](https://github.com/LightningNetwork/lnd), [eclair](https://github.com/ACINQ/eclair), or [Core Lightning](https://github.com/ElementsProject/lightning) using the [REST](https://github.com/Ride-The-Lightning/c-lightning-REST/) or [Sparko](https://github.com/fiatjaf/sparko) API.

You must provide Zeus with your node's hostname, port number, and the macaroon you choose to use in **hex format**. If you need help converting your macaroon to hex format we wrote up a Node.js script that can use
[here](https://github.com/ZeusLN/lnd-hex-macaroon-generator/). Alternatively, if you're running a Unix-based operating system (eg. macOS, Linux) you can run `xxd -ps -u -c 1000 /path/to/admin.macaroon` to generate your macaroon in hex format.

### Tor Connection Guides

Zeus has support for connecting to you node entirely over the Tor network. You can refer to these guides to set up a Tor hidden service on your lnd node. The instructions are generally interchangeable and typically only require you to change your Tor path.

* [Zeus over Tor guide for RaspiBolt](https://raspibolt.org/guide/lightning/mobile-app.html)
* [Zeus over Tor guide for FreeNAS by Seth586](https://github.com/seth586/guides/blob/master/FreeNAS/wallets/zeusln.md)
* [Zeus over Tor guide for RaspiBlitz by openoms](https://github.com/openoms/bitcoin-tutorials/blob/master/Zeus_to_RaspiBlitz_through_Tor.md)
* [Tor-Only Bitcoin & Lightning Guide by Lopp](https://blog.lopp.net/tor-only-bitcoin-lightning-guide/)

## Integrations

Zeus is proud to be integrated on the following platforms:

### Full node solutions
* [nodl](https://www.nodl.it/)
* [myNode](https://mynodebtc.com/) ([Standard guide](https://mynodebtc.com/guide/zeus), [Tor guide](https://mynodebtc.com/guide/zeus_tor))
* [RaspiBlitz](https://github.com/rootzoll/raspiblitz)
* [Umbrel](https://getumbrel.com/)
* [Citadel](https://runcitadel.space/)

### Payment platforms
* [BTCPay Server](https://btcpayserver.org/)
* [LNBits](https://lnbits.com/)

### Android nodes
* [Nayuta Core](https://nayuta.co/core/)

## Starting development

**Don't trust, verify** the code with your own two eyes. Then when ready proceed to the steps below based on your platform.

### Android
1. install and setup react-native and its related dependencies under **"Building Projects with Native Code"** on
[react-native's Getting Started page](https://reactnative.dev/docs/environment-setup)
2. if using your phone,
[enable Developer mode and USB Debugging](https://developer.android.com/studio/debug/dev-options)
, then make sure it is connected to your computer by running `adb devices`
3. install node dependencies with `yarn`
4. open up your Android simulator or connect your phone and run `npx react-native start`
5. open a new tab and run `npx react-native run-android`

### iOS
1. install and setup react-native and its related dependencies under **"Building Projects with Native Code"** on
[react-native's Getting Started page](https://reactnative.dev/docs/environment-setup)
2. install node dependencies with `yarn`
3. `cd ios && pod install`
4. open `ios/zeus.xcworkspace` in Xcode and hit Run.

## Contributing

Please be sure to run `yarn run tsc` to check for type errors, `yarn run test` to run all tests, and `yarn run prettier` to run the prettier

If you are making cosmetic changes please test on both Android and iOS as things don't render exactly the same on both platforms.

If you're looking for a quick way to get a lightning development environment running, check out [Polar](https://github.com/jamaljsr/polar).

NOTE: When configuring a new node on Android in dev, the `Host` field must be `10.0.2.2` - `127.0.0.1` or `localhost` won't work.

## Reproducible builds

Reproducible builds are available for Android only right now. You'll need Docker installed to be able to build the app this way:

1. Clone Zeus git for the branch/tag that you want to build. For example: `git clone --depth 1 --branch v0.7.0 https://github.com/ZeusLN/zeus.git`
    You can also remove the `--branch v0.7.0` parameter to build APKs for `master`.
2. Change to the zeus directory: `cd zeus`
3. Execute the build script: `./build.sh`
4. If everything goes well, the script will print a list of all the generated APK files and SHA256 hashes for each one of them: armv7, armv8, x86, x86_64, universal. The equivalent to the one provided in the web page is the one ending in 'universal'. You can compare SHA256 hashes with the ones provided on the [GitHub releases page](https://github.com/ZeusLN/zeus/releases)
5. Download the oficial APK from [GitHub releases page](https://github.com/ZeusLN/zeus/releases) or from the [Zeus homepage](https://zeusln.app/): `wget https://zeusln.app/zeus-v0.7.0.apk`
6. Compare both APKs with a suitable utility like `diffoscope`, `apksigcopier` or by running `diff --brief --recursive ./unpacked_oficial_apk ./unpacked_built_apk`. You should only get differences for the certificates used to sign the official APK

If you want to install the APK built this way onto your own smartphone, you'll need to sign it yourself (see next section). Note that the first time you install a build made using this procedure, you'll need to uninstall your current version of Zeus and then install the one built here because certificates will not match. You'll lose your connection details and you'll need to reconfigure Zeus again to connect to your nodes.

### Signing APKs

1. Install signing utilities: `apt-get install -y apksigner`
2. Create your certificate, if you haven't done so already. If you already have the certificate from previous builds, it's advised that you use the same one so you are able to upgrade from one APK to the next one without reinstalling first: `keytool -genkeypair -alias zeus -keystore zeus.pfx -v -storetype PKCS12 -keyalg RSA -keysize 2048 -storepass your_keystore_password -keypass your_key_password -validity 10000 -dname "cn=Unknown, ou=Unknown, o=Unknown, c=Unknown"`
3. Sign the chosen APK file using this command: `java -jar /usr/bin/apksigner sign -v --ks zeus.pfx --ks-key-alias zeus --ks-pass pass:your_keystore_password --key-pass pass:your_key_password zeus-universal.apk`
4. Copy the signed APK to your smartphone and install it by tapping over the file. If you get an error, you'll have to uninstall your currently installed version of Zeus first. Note that you'll lose your connections and you'll need to reconfigure Zeus again to connect to your node.

## Translations

Do not directly modify the files in `/locales` unless you are adding new copy to the app in English. Instead, translators and reviewers should visit out [Transifex page](https://app.transifex.com/ZeusLN/zeus/) and request a role on the language you'd like to contribute to.

## Release + Commit Verification

All releases and all maintainer commits as of October 20, 2021 are signed by key `AAC48DE8AB8DEE84` (zeusln@tutanota.com). The key can be found [in this repo](https://github.com/ZeusLN/zeus/blob/master/PGP.txt) and [on the ZeusLN.app website](https://zeusln.app/PGP.txt).


### Past Keys
`989CC718EBA8BB68` (January 24, 2020 - October 19, 2021)

## Donations

If you'd like to help us with the cost of running Zeus project (iOS developer account, Google Play developer account, hosting) you can send a payment to us via our [BTCPayServer portal](https://pay.zeusln.app/), via Lightning Address (tips@pay.zeusln.app), or via PayNym ([+holymorning7d1](http://my.paynym.is/+holymorning7d1)). You can also become a [community sponsor](https://zeusln.app/about#communitySponsors) and have your Twitter or Nostr avatar displayed on our website and in-app.

Thank you.

### Our Contributors
<a href="https://github.com/zeusLN/zeus/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=zeusLN/zeus" />
</a>

## License

Distributed under the GNU Affero General Public License (AGPL v3). See [LICENSE file](LICENSE).
