# Zeus
A mobile Bitcoin/Lightning app for lnd, c-lightning, and Eclair node operators ⚡️

*Notice*: If you are looking for Zeus Server, the Lightning-based Point-of-Sale solution (unrelated to this project), please visit [puzzle/zeus](https://github.com/puzzle/zeus).

<p align="center"><img src="https://user-images.githubusercontent.com/47701173/55770407-2e2c8b00-5a52-11e9-933f-2819eb138c7d.png"></p>



Zeus is built on TypeScript and React-Native. It runs on both iOS and Android.

*Disclaimer*: Zeus and Lightning in general are software projects in their early development stages. Please be wary when using Lightning and do not fund your node with more money than you are willing to lose.

### App Store links
* [Google Play](https://play.google.com/store/apps/details?id=app.zeusln.zeus)
* [Apple App Store](https://apps.apple.com/us/app/zeus-ln/id1456038895)
* [F-Droid](https://f-droid.org/packages/app.zeusln.zeus/)

### Get in touch with us
* Come chat with us on
[Telegram](https://t.me/zeusLN)
* Join our
[developer Slack](https://zeusln.slack.com/join/shared_invite/zt-qw205nqa-o4VJJC0zPI7HiSfToZGoVw#/)
* Keep up with us on
[Twitter](https://twitter.com/ZeusLN)
* Open a channel with
[our main node](https://1ml.com/node/03e1210c8d4b236a53191bb172701d76ec06dfa869a1afffcfd8f4e07d9129d898)
or
[our Olympus node](https://1ml.com/node/02c2d8e5f8220c99d92f4fe808e7c5332d33d146db3e63a50f03663addfaa5a8df)

## Connecting to your node

Currently, to use Zeus, you must have a Bitcoin Lightning node running
[Lightning Network Daemon (lnd)](https://github.com/LightningNetwork/lnd), [eclair](https://github.com/ACINQ/eclair), or [c-lightning](https://github.com/ElementsProject/lightning) using the [c-lightning-REST](https://github.com/Ride-The-Lightning/c-lightning-REST/) or [Spark](https://github.com/shesek/spark-wallet#server-installation) API .

You must provide Zeus with your node's hostname, port number, and the macaroon you choose to use in **hex format**. If you need help converting your macaroon to hex format we wrote up a Node.js script that can use
[here](https://github.com/ZeusLN/lnd-hex-macaroon-generator/). Alternatively, if you're running a Unix-based operating system (eg. macOS, Linux) you can run `xxd -ps -u -c 1000 /path/to/admin.macaroon` to generate your macaroon in hex format.

### Tor Connection Guides

On Android Zeus has support for connecting to you node entirely over the Tor network. You can refer to these guides to set up a Tor hidden service on your lnd node. The instructions are generally interchangable and typically only require you to change your Tor path.

* [Zeus over Tor guide for RaspiBolt](https://stadicus.github.io/RaspiBolt/raspibolt_72_zeus-over-tor.html)
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

### Payment platforms
* [BTCPay Server](https://btcpayserver.org/)
* [LNBits](https://lnbits.com/)

### Android nodes
* [Nayuta Core](https://nayuta.co/core/)

## Building Zeus from source

**Don't trust, verify** the code with your own two eyes. Then when ready proceed to the steps below based on your platform.

### Android
1. install and setup react-native and its related dependencies under **"Building Projects with Native Code"** on
[react-native's Getting Started page](https://facebook.github.io/react-native/docs/getting-started.html)
2. if using your phone,
[enable Developer mode and USB Debugging](https://developer.android.com/studio/debug/dev-options)
, then make sure it is connected to your computer by running `adb devices`
3. install node dependencies with `npm i`
4. open up your Android simulator or connect your phone and run `react-native run-android`

### iOS
1. install and setup react-native and its related dependencies under **"Building Projects with Native Code"** on
[react-native's Getting Started page](https://facebook.github.io/react-native/docs/getting-started.html)
2. install node dependencies with `npm i`
3. `cd ios && pod install`
4. open `ios/zeus.xcworkspace` in Xcode and hit Run

## Google Play Releases

Google Play releases aren't fully featured due to Google policies. To get the fully featured version of Zeus on Android you must download the APK from the [Zeus website](https://zeusln.app), GitHub, or F-Droid. Google Play releases are managed on the `play-releases` branch. Commits used for Google Play builds will be marked in the release notes.

## Contributing

Please be sure to run `npm run tsc` to check for type errors, `npm run test` to run all tests, and `npm run prettier` to run the prettier

If you are making cosmetic changes please test on both Android and iOS as things don't render exactly the same on both platforms.


## Translations

Do not directly modify the files in `/locales` unless you are adding new copy to the app in English. Instead, translators and reviewers should visit out [Transifex page](https://www.transifex.com/ZeusLN/zeus/) and request a role on the language you'd like to contribute to.

## Release + Commit Verification

All releases and all maintainer commits as of January 24, 2020 are signed by key `989CC718EBA8BB68` (zeusln@tutanota.com). The key can be found [in this repo](https://github.com/ZeusLN/zeus/blob/master/PGP.txt) and [on the ZeusLN.app website](https://zeusln.app/PGP.txt).

## Donations

If you'd like to help us with the cost of running Zeus project (iOS developer account, Google Play developer account, hosting) you can send a payment to us via PayNym
[+holymorning7d1](http://my.paynym.is/+holymorning7d1), via [tippin.me](https://tippin.me/@ZeusLN), or via keysend. Our node can be found at ```03e1210c8d4b236a53191bb172701d76ec06dfa869a1afffcfd8f4e07d9129d898@zg6ziy65wqhiczqfqupx26j5yjot5iuxftqtiyvika3xoydc5hx2mtyd.onion:9735```.

Thank you.

## License

Distributed under the GNU Affero General Public License (AGPL v3). See [LICENSE file](LICENSE).
