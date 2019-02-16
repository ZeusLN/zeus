# Zeus
A mobile Bitcoin app for Lightning Network Daemon (lnd) node operators ⚡️

![Zeus](https://user-images.githubusercontent.com/1878621/52906010-644b4c80-3211-11e9-9b05-4642e5263cf1.jpg)

Zeus is built on TypeScript and React-Native. It runs on both iOS and Android.

*Disclaimer*: Zeus and Lightning in general are software projects in their early development stages. Please be wary when using Lightning and do not fund your node with more money than you are willing to lose.

## Connecting to your node

Currently, to use Zeus, you must have a Bitcoin Lightning node running [Lightning Network Daemon (lnd)](https://github.com/LightningNetwork/lnd).

You must provide Zeus with your node's hostname, port number, and the lnd macaroon you choose to use in **hex format**.

If you would like to learn more about running your own guide we suggest checking out the following guides:
* If you're looking to run a full node on existing hardware running Windows or macOS, check out Pierre Rochard's [Lightning Power Node Launcher](https://github.com/PierreRochard/node-launcher). We recommend reading [this guide](https://medium.com/lightning-power-users/windows-macos-lightning-network-284bd5034340).
* If you're looking to run a full node on a dedicated piece of hardware like a Raspberry Pi, check out Stadicus' [Raspibolt Tutorial](https://github.com/Stadicus/guides/tree/master/raspibolt).

### Using a self-signed lnd cert with iOS

If you are using a self-signed lnd cert (as is the default in lnd), you must create a provisioning profile for your device or simulator in able to connect to your node.

Check out [this guide](https://www.howtogeek.com/253325/how-to-create-an-ios-configuration-profile-and-alter-hidden-settings/) for setting up a configuration profile. You want to add your LND cert to the section marked `Certificates` before associating the profile to your device.

## Building Zeus from source

**Don't trust, verify** the code with your own two eyes. Then when ready proceed to the steps below based on your platform.

### Android:
1. install dependencies with `npm i`
2. open up your Android simulator or connect your phone and run `react-native run-android`

### iOS
1. install dependencies with `npm i`
2. open `ios/zeus.xcodeproj` in Xcode and hit Run

#### Using a local lnd node with iOS

If you are running lnd on the same machine you're running your iOS simulator (for example, if you're using the Lightning Power Node Launcher mentioned above) you will have to use the following workaround.

Insert the following snippet right below the line `#pragma mark - NSURLSession delegate` in the file `node_modules/react-native/Libraries/Network/RCTHTTPRequestHandler.mm`.

```
- (void)URLSession:(NSURLSession *)session didReceiveChallenge:(NSURLAuthenticationChallenge *)challenge completionHandler:(void (^)(NSURLSessionAuthChallengeDisposition disposition, NSURLCredential *credential))completionHandler
{
  completionHandler(NSURLSessionAuthChallengeUseCredential, [NSURLCredential credentialForTrust:challenge.protectionSpace.serverTrust]);
}
```

Do not use this workaround in production.

## Contributing

Please be sure to run `tsc` to check for type errors and `npm run test` to run all tests.

If you are making cosmetic changes please test on both Android and iOS as things don't render exactly the same on both platforms.

## Donations

If you'd like to help us with the cost of running Zeus project (iOS developer account, Google Play developer account, hosting) you can send a payment to [3Lbz4vdt15Fsa4wVD3Yk8uGf6ugKKY4zSc](https://blockstream.info/address/3Lbz4vdt15Fsa4wVD3Yk8uGf6ugKKY4zSc).

Thank you.

## License

Distributed under the GNU Affero General Public License (AGPL v3). See [LICENSE file](LICENSE)
