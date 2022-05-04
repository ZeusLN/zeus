# Zeus
<p align="center"><img src="https://user-images.githubusercontent.com/55287964/163089394-87203617-cfd8-4227-8d00-1a11a98b04fb.png"></p>

Zeus is a mobile Bitcoin/Lightning node manager and wallet application for LND, Core Lightning, and Eclair. ⚡️

Zeus is built on TypeScript and React-Native. It runs on both iOS and Android.

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
[our node](https://amboss.space/node/031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581)

## Features

- [x] Bitcoin only wallet
- [x] Non-custodial
- [x] No processing fees
- [x] No KYC
- [x] Fully open source (APGLv3)
- [x] Connect to LND, Core Lightning (Rest + spark) or Eclair lightning node
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
- [x] Lighting channel management
- [x] Detailed routing reports
- [x] Set and manage routing fees
- [x] MPP/AMP support
- [x] Keysend support
- [x] SegWit support 
- [x] Sign & verify messages
- [x] Fiat currency integrations
- [x] [Various language support](https://www.transifex.com/ZeusLN/zeus/)
- [x] Multi-theme
- [ ] On-chain coin control 
- [ ] External signer support
- [ ] Watch-only accounts
- [ ] Contact list for easier payments
- [ ] Multiple profile types (payments, merchant etc.)
- [ ] Lightning address receive
- [ ] Taproot support 
- [ ] Connect a watchtower
- [ ] Advanced security center
- [ ] Notifications 
- [ ] Batch on-chain transactions
- [ ] Batch channel opens
- [ ] PayJoin

## Connecting Zeus to your node

Currently, to use Zeus, you must have a Bitcoin Lightning node running [Lightning Network Daemon (lnd)](https://github.com/LightningNetwork/lnd), [eclair](https://github.com/ACINQ/eclair), or [Core Lightning](https://github.com/ElementsProject/lightning) using the [REST](https://github.com/Ride-The-Lightning/c-lightning-REST/) or [Spark](https://github.com/shesek/spark-wallet#server-installation) API.

You must provide Zeus with your node's hostname, port number, and the macaroon you choose to use in **hex format**. If you need help converting your macaroon to hex format we wrote up a Node.js script that can use
[here](https://github.com/ZeusLN/lnd-hex-macaroon-generator/). Alternatively, if you're running a Unix-based operating system (eg. macOS, Linux) you can run `xxd -ps -u -c 1000 /path/to/admin.macaroon` to generate your macaroon in hex format.

### Tor Connection Guides

Zeus has support for connecting to you node entirely over the Tor network. You can refer to these guides to set up a Tor hidden service on your lnd node. The instructions are generally interchangable and typically only require you to change your Tor path.

* [Zeus over Tor guide for RaspiBolt](https://raspibolt.org/mobile-app.html)
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
[react-native's Getting Started page](https://reactnative.dev/docs/environment-setup)
2. if using your phone,
[enable Developer mode and USB Debugging](https://developer.android.com/studio/debug/dev-options)
, then make sure it is connected to your computer by running `adb devices`
3. install node dependencies with `npm i`
4. open up your Android simulator or connect your phone and run `npx react-native start`
5. open a new tab and run `npx react-native run-android`

### iOS
1. install and setup react-native and its related dependencies under **"Building Projects with Native Code"** on
[react-native's Getting Started page](https://reactnative.dev/docs/environment-setup)
2. install node dependencies with `npm i`
3. `cd ios && pod install`
4. open `ios/zeus.xcworkspace` in Xcode and hit Run. NOTE: if you're using an M1 mac, you may need to right click Xcode > get info > check `Open using Rosetta` before opening `zeus.xcworkspace`.

## Contributing

Please be sure to run `npm run tsc` to check for type errors, `npm run test` to run all tests, and `npm run prettier` to run the prettier

If you are making cosmetic changes please test on both Android and iOS as things don't render exactly the same on both platforms.

If you're looking for a quick way to get a lightning development environment running, check out [Polar](https://github.com/jamaljsr/polar).

## Translations

Do not directly modify the files in `/locales` unless you are adding new copy to the app in English. Instead, translators and reviewers should visit out [Transifex page](https://www.transifex.com/ZeusLN/zeus/) and request a role on the language you'd like to contribute to.

## Release + Commit Verification

All releases and all maintainer commits as of October 20, 2021 are signed by key `AAC48DE8AB8DEE84` (zeusln@tutanota.com). The key can be found [in this repo](https://github.com/ZeusLN/zeus/blob/master/PGP.txt) and [on the ZeusLN.app website](https://zeusln.app/PGP.txt).


### Past Keys
`989CC718EBA8BB68` (January 24, 2020 - October 19, 2021)

## Donations

If you'd like to help us with the cost of running Zeus project (iOS developer account, Google Play developer account, hosting) you can send a payment to us via our [BTCPayServer portal](https://pay.zeusln.app/), via Lightning Address (tips@pay.zeusln.app), or via PayNym ([+holymorning7d1](http://my.paynym.is/+holymorning7d1)). You can also become an [Olympian-level community sponsor](https://zeusln.app/about#communitySponsors) and have your Twitter avatar displayed on our website and in-app.

Thank you.

## License

Distributed under the GNU Affero General Public License (AGPL v3). See [LICENSE file](LICENSE).
