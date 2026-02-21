# ZEUS
<p align="center"><img src="https://github-production-user-asset-6210df.s3.amazonaws.com/1878621/282360800-579c1156-1fc6-45b6-86f2-7b3424502160.png"></p>
<p align="center"><img width="2250" height="1406" alt="screenshots3" src="https://github.com/user-attachments/assets/3e6e5a34-ee1b-4b8d-876d-f6f64d5d7c38" /></p>

ZEUS is a mobile Bitcoin/Lightning wallet and remote node manager for LND and Core Lightning. ⚡️

ZEUS is built on TypeScript and React Native. It runs on both Android and iOS.

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ZeusLN/zeus)


Read more on our [documentation site](https://docs.zeusln.app/).

### App Store links

#### Android
* [Google Play](https://play.google.com/store/apps/details?id=app.zeusln.zeus)
* [F-Droid](https://zeusln.com/download)
* [Zapstore](https://zapstore.dev/apps/naddr1qvzqqqr7pvpzqdxj75n57x2clnfvkfrrm2l2mhu2y8uy4njzg8dg3qprhuzueqy4qq8kzurs9eax2atnd3hzu7n9w4essgljvy)

#### iOS

* [Apple App Store](https://apps.apple.com/us/app/zeus-ln/id1456038895)

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
- [x] Connect a watchtower
- [ ] Advanced security center
- [x] Batch on-chain transactions
- [x] Batch channel opens
- [ ] PayJoin
- [x] [Lightning Node Connect](https://docs.lightning.engineering/lightning-network-tools/lightning-terminal/lightning-node-connect)
- [x] [Self-custodial lightning address (ZEUS Pay)](https://docs.zeusln.app/lightning-address/intro)

## Remote Connections and Integrations

See the [Remote Connections and Integrations](docs/RemoteConnections.md) document for details on connecting ZEUS to your node, Tor connection guides, and platform integrations.

For the most up-to-date remote connection guides, visit our [documentation site](https://docs.zeusln.app/category/remote-connections).

## Starting development

**Don't trust, verify** the code with your own two eyes. Then when ready proceed to the steps below based on your platform.

### Prerequisites
- Node.js (minimum version: `v22.11`)

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

We welcome contributions from the community. Please read our [Contribution Guidelines](CONTRIBUTING.md).

First-time contributors are [highly encouraged to start with code review first](CODE_REVIEW.md), before creating their own Pull Requests.

## Reproducible builds

Read our docs on reproducible builds [here](https://github.com/ZeusLN/zeus/blob/master/docs/ReproducibleBuilds.md).

## Translations

Do not directly modify the files in `/locales` unless you are adding new copy to the app in English. Instead, translators and reviewers should visit out [Transifex page](https://app.transifex.com/ZeusLN/zeus/) and request a role on the language you'd like to contribute to.

## Release + Commit Verification

All releases and all maintainer commits as of October 20, 2021 are signed by key `AAC48DE8AB8DEE84` (zeusln@tutanota.com). The key can be found [in this repo](https://github.com/ZeusLN/zeus/blob/master/PGP.txt) and [on the ZeusLN.com website](https://zeusln.com/PGP.txt).


### Past Keys
`989CC718EBA8BB68` (January 24, 2020 - October 19, 2021)

## Donations

If you'd like to help cover the development costs of running the ZEUS project you can send a payment to us via our [BTCPayServer portal](https://pay.zeusln.app/), via Lightning Address (tips@pay.zeusln.app), or via PayNym ([+holymorning7d1](http://my.paynym.is/+holymorning7d1)). You can also become a [community sponsor](https://zeusln.com/about#communitySponsors) and have your Twitter or Nostr avatar displayed on our website and in-app.

As of v0.11.5, you can also donate an additional percentage of each Lightning payment made in the wallet. You can set your donation percentage under `Menu` > `Support ZEUS` > `Add a Tip with Each Payment` or under `Payment settings`.

Thank you.

## License

Distributed under the GNU Affero General Public License (AGPL v3). See [LICENSE file](LICENSE).
