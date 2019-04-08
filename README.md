# Zeus
A mobile Bitcoin app for Lightning Network Daemon (lnd) node operators ⚡️

<p align="center"><img src="https://user-images.githubusercontent.com/47701173/55417522-d7e5b680-553e-11e9-9488-a322d6c1d021.png"></p>

Zeus is built on TypeScript and React Native. It runs on both iOS and Android.

*Disclaimer*: Zeus and Lightning in general are software projects in their early development stages. Please be wary when using Lightning and do not fund your node with more money than you are willing to lose.

### App Store links
* [F-Droid](https://staging.f-droid.org/en/packages/com.zeusln.zeus/)
* [Google Play](https://play.google.com/store/apps/details?id=com.zeusln.zeus)
* [Apple TestFlight](https://testflight.apple.com/join/gpVFzEHN)

### Get in touch with us
* Come chat with us on
[Telegram](https://t.me/zeusLN)
* Keep up with us on
[Twitter](https://twitter.com/ZeusLN)
* Open a channel with 
[our node](https://1ml.com/node/03b053229a315d4071520d7466f50b91be0edad375122c15932ba3334539a72a6c)


## Connecting to your node

Currently, to use Zeus, you must have a Bitcoin Lightning node running
[Lightning Network Daemon (lnd)](https://github.com/LightningNetwork/lnd).

You must provide Zeus with your node's hostname, port number, and the lnd macaroon you choose to use in **hex format**. If you need help converting your macaroon to hex format we wrote up a Node.js script that can use
[here](https://github.com/ZeusLN/lnd-hex-macaroon-generator/). Alternatively, if you're running a Unix-based operating system (eg. macOS, Linux) you can run `xxd -ps -u -c 1000 /path/to/admin.macaroon` to generate your macaroon in hex format.

If you would like to learn more about running your own guide we suggest checking out the following guides:
* If you're looking to run a full node on existing hardware running Windows or macOS, check out Pierre Rochard's
[Lightning Power Node Launcher](https://github.com/PierreRochard/node-launcher).
We recommend reading
[this guide](https://medium.com/lightning-power-users/windows-macos-lightning-network-284bd5034340).
* If you're looking to run a full node on a dedicated piece of hardware like a Raspberry Pi, check out Stadicus'
[Raspibolt Tutorial](https://github.com/Stadicus/guides/tree/master/raspibolt) or
[RaspiBlitz](https://github.com/rootzoll/raspiblitz/).

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
3. apply patches with `npm run patch`
4. open `ios/zeus.xcodeproj` in Xcode and hit Run

## Contributing

Please be sure to run `tsc` to check for type errors and `npm run test` to run all tests.

If you are making cosmetic changes please test on both Android and iOS as things don't render exactly the same on both platforms.

## Donations

If you'd like to help us with the cost of running Zeus project (iOS developer account, Google Play developer account, hosting) you can send a payment to
[3Lbz4vdt15Fsa4wVD3Yk8uGf6ugKKY4zSc](https://blockstream.info/address/3Lbz4vdt15Fsa4wVD3Yk8uGf6ugKKY4zSc).

Thank you.

## License

Distributed under the GNU Affero General Public License (AGPL v3). See [LICENSE file](LICENSE).
