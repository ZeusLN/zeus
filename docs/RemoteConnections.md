# Remote Connections and Integrations

For the most up-to-date guides on connecting ZEUS to your node, please visit our [Remote Connections documentation](https://docs.zeusln.app/category/remote-connections).

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
