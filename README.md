# ZEUS
<p align="center"><img src="https://github-production-user-asset-6210df.s3.amazonaws.com/1878621/282360800-579c1156-1fc6-45b6-86f2-7b3424502160.png"></p>

![ZEUS screenshots](https://github.com/user-attachments/assets/337e6549-26e2-4319-9fc1-0937a81bb15d)

ZEUS is a mobile Bitcoin/Lightning wallet and remote node manager for LND and Core Lightning. ⚡️

ZEUS is built on TypeScript and React Native. It runs on both Android and iOS.

Read more on our [documentation site](https://docs.zeusln.app/).

### App Store links
* [Google Play](https://play.google.com/store/apps/details?id=app.zeusln.zeus)
* [Apple App Store](https://apps.apple.com/us/app/zeus-ln/id1456038895)
* [F-Droid](https://zeusln.com/download)

### Get in touch with us
* Come chat with us on
[Telegram](https://t.me/zeusLN)
* Join our
[developer Slack](https://zeusln.slack.com/join/shared_invite/zt-qw205nqa-o4VJJC0zPI7HiSfToZGoVw#/)
* Keep up with us on
[Twitter](https://twitter.com/ZeusLN)
and
[Nostr](https://iris.to/npub1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5)
* Open a channel with
[our node](https://amboss.space/node/031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581)

## Features

- [x] Bitcoin only wallet
- [x] Self-custodial
- [x] No KYC
- [x] Fully open source (AGPLv3)
- [x] [Connect to LND or Core Lightning remote node](https://docs.zeusln.app/category/remote-connections)
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
- [x] External signer support
- [x] Watch-only accounts
- [x] Contact list for easier payments
- [x] Nostr contact import
- [x] Point of Sale (Standalone and Square integration)
- [x] Lightning address receive
- [x] Taproot support 
- [ ] Connect a watchtower
- [ ] Advanced security center
- [x] Batch on-chain transactions
- [x] Batch channel opens
- [ ] PayJoin
- [x] [Lightning Node Connect](https://docs.lightning.engineering/lightning-network-tools/lightning-terminal/lightning-node-connect)
- [x] [Self-custodial lightning address (ZEUS Pay)](https://docs.zeusln.app/lightning-address/intro)

## Connecting ZEUS to your node

You can connect ZEUS to a remote Bitcoin Lightning node running [Lightning Network Daemon (lnd)](https://github.com/LightningNetwork/lnd) or [Core Lightning](https://github.com/ElementsProject/lightning).

You must provide ZEUS with your node's hostname, port number, and the macaroon you choose to use in **hex format**. If you need help converting your macaroon to hex format we wrote up a Node.js script that can use
[here](https://github.com/ZeusLN/lnd-hex-macaroon-generator/). Alternatively, if you're running a Unix-based operating system (eg. macOS, Linux) you can run `xxd -ps -u -c 1000 /path/to/admin.macaroon` to generate your macaroon in hex format.

### Tor Connection Guides

ZEUS has support for connecting to you node entirely over the Tor network. You can refer to these guides to set up a Tor hidden service on your lnd node. The instructions are generally interchangeable and typically only require you to change your Tor path.

* [ZEUS over Tor guides for StartOS](https://docs.start9.com/0.3.5.x/service-guides/lightning/index)
* [ZEUS over Tor guide for RaspiBolt](https://raspibolt.org/guide/lightning/mobile-app.html)
* [ZEUS over Tor guide for FreeNAS by Seth586](https://github.com/seth586/guides/blob/master/FreeNAS/wallets/zeusln.md)
* [ZEUS over Tor guide for RaspiBlitz by openoms](https://github.com/openoms/bitcoin-tutorials/blob/master/Zeus_to_RaspiBlitz_through_Tor.md)
* [Tor-Only Bitcoin & Lightning Guide by Lopp](https://blog.lopp.net/tor-only-bitcoin-lightning-guide/)

## Integrations

ZEUS is proud to be integrated on the following platforms:

### Full node solutions
* [StartOS](https://www.start9.com/), [Guides](https://docs.start9.com/0.3.5.x/service-guides/lightning/index)
* [nodl](https://www.nodl.it/)
* [myNode](https://mynodebtc.com/) ([Standard guide](https://mynodebtc.com/guide/zeus), [Tor guide](https://mynodebtc.com/guide/zeus_tor))
* [RaspiBlitz](https://github.com/rootzoll/raspiblitz)
* [Umbrel](https://getumbrel.com/)

### Payment platforms
* [BTCPay Server](https://btcpayserver.org/)
* [LNBits](https://lnbits.com/)

## Starting development

**Don't trust, verify** the code with your own two eyes. Then when ready proceed to the steps below based on your platform.

### Prerequisites
- Node.js (minimum version: 18.18)

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

Read our docs on reproducible builds [here](https://github.com/ZeusLN/zeus/blob/master/docs/ReproducibleBuilds.md).

## Translations

Do not directly modify the files in `/locales` unless you are adding new copy to the app in English. Instead, translators and reviewers should visit out [Transifex page](https://app.transifex.com/ZeusLN/zeus/) and request a role on the language you'd like to contribute to.

## Release + Commit Verification

All releases and all maintainer commits as of October 20, 2021 are signed by key `AAC48DE8AB8DEE84` (zeusln@tutanota.com). The key can be found [in this repo](https://github.com/ZeusLN/zeus/blob/master/PGP.txt) and [on the ZeusLN.com website](https://zeusln.com/PGP.txt).


### Past Keys
`989CC718EBA8BB68` (January 24, 2020 - October 19, 2021)

## Donations

If you'd like to help us with the cost of running Zeus project (iOS developer account, Google Play developer account, hosting) you can send a payment to us via our [BTCPayServer portal](https://pay.zeusln.app/), via Lightning Address (tips@pay.zeusln.app), or via PayNym ([+holymorning7d1](http://my.paynym.is/+holymorning7d1)). You can also become a [community sponsor](https://zeusln.com/about#communitySponsors) and have your Twitter or Nostr avatar displayed on our website and in-app.

Thank you.

## License

Distributed under the GNU Affero General Public License (AGPL v3). See [LICENSE file](LICENSE).
