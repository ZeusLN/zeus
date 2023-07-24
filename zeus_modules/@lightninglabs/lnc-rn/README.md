# @lightninglabs/lnc-rn

## Lightning Node Connect npm module for React Native

## Install

First, install the npm module
`npm i @lightninglabs/lnc-rn`

Navigate to the lnc-rn npm module folder
`cd node_modules/@lightninglabs/lnc-rn`

Fetch the required LNC libraries
`yarn run fetch-libraries`

### Android

In your app's `android/app/build.gradle` file, add the following line to your `dependency` block:

```implementation files("../../node_modules/@lightninglabs/lnc-rn/android/libs/lnc-mobile.aar")```

### iOS

First, in Xcode, drag the `Lncmobile.xcframework` folder into your Xcode project - ideally grouped in the project's Framework folder. Make sure you add it to your project's primary target.

The `Lncmobile.xcframework` folder can be found in the `node_modules/@lightninglabs/lnc-rn/ios` directory.

Then, in your project's `ios` folder, run `pod install`.

### Building library files manually

The library files can be built manually from the [Lightning Node Connect](https://github.com/lightninglabs/lightning-node-connect) repo using the `make android` and `make ios` commands.

## Persistent storage

Unlike [lnc-web](https://github.com/lightninglabs/lnc-web), lnc-rn does not store users' credentials by defaults. We recommend taking a look at one of the [credentialStores](https://github.com/lightninglabs/lnc-rn/blob/main/demos/connect-demo/credentialStore.ts) from our demo apps to see how you can store users' credentials securely using [react-native-encrypted-storage](https://github.com/emeraldsanto/react-native-encrypted-storage).

## API Design

#### Set-up and connection

The constructor for the LNC object takes a parameters object with the three following fields:

-   `pairingPhrase` (string): Your LNC pairing phrase
-   `serverHost` (string): Specify a custom Lightning Node Connect proxy server. If not specified we'll default to `mailbox.terminal.lightning.today:443`.

```
import LNC from ‘@lightninglabs/lnc-rn’;

const pairingPhrase = ‘artefact morning piano photo consider light’;

// default connection
// default host: mailbox.terminal.lightning.today:443
const lnc = new LNC({
   pairingPhrase
});

// using custom Lightning Node Connect proxy server
const lnc = new LNC({
   pairingPhrase,
   serverHost: ‘custom.lnd-server.host:443’
});

// connect
lnc.connect();

// check connection status
lnc.isConnected();

// disconnect
lnc.disconnect();
```

#### Base functions

All of the services (lnd, loop, pool, faraday) will be objects under the main lnc object. Each services’ sub-services will be underneath each service object, and each sub-service function below that (except in the case of faraday which only has one service - its functions will live directly under it). All service, function, and param names will be camel-cased.

```
const { lnd, loop, pool, faraday } = lnc;

// all functions on the base object should have proper types
// sub-servers exist as objects on each main service
lnd.lightning.listInvoices();
lnd.lightning.connectPeer({ addr: ‘03aa49c1e98ff4f216d886c09da9961c516aca22812c108af1b187896ded89807e@m3keajflswtfq3bw4kzvxtbru7r4z4cp5stlreppdllhp5a7vuvjzqyd.onion:9735’ });

const signature = lnd.signer.signMessage({...params});

const swaps = await loop.swapClient.listSwaps();
const poolAccount = await pool.trader.initAccount({
   accountValue: 100000000,
   relativeHeight: 1000
 });

const insights = await faraday.channelInsights();
```

#### Subscriptions

```
import { NativeEventEmitter } from 'react-native';
const { LncModule } = NativeModules;

const request = {};
const eventName = lnc.lnd.lightning.subscribePeerEvents(request);
const eventEmitter = new NativeEventEmitter(LncModule);
listener = eventEmitter.addListener(eventName, (event: any) => {
    console.log('Got response', event.result);
});

// when ready to stop listener
listener.stop();
```

## Demos

To highlight the functionality of `lnc-rn` we've included two demos in the repo: `connect-demo` and `multi-connect-demo`. To run these you must run `yarn run install-lnc` after installing their npm dependencies to fetch the LNC mobile binaries, which are not bundled into the module directly.

## Further documentation

- https://docs.lightning.engineering/lightning-network-tools/lightning-terminal/lnc-npm
