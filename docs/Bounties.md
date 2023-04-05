# Open Bounties

The Zeus team is putting up the tasks listed below for bounty. Working code must be merged for a user to collect the bounty. To inquire about status of a bounty, to contribute to a bounty, or to proprose a new bounty please email zeusln (at) tutanota (dot) com. Thank you.

## Core Lightning: Commando/lnmessage connection

Payout: 1,500,000 sats (0.015 BTC)

Currently, Zeus supports remote connections to Core Lightning (CLN) through c-lightning-REST and Spark. We'd like for users to connect to CLN nodes using the [Commando](https://lightning.readthedocs.io/lightning-commando.7.html) and [lnmessage](https://github.com/aaronbarnardsound/lnmessage). We've made some pretty good progress on [this branch](https://github.com/ZeusLN/zeus/compare/master...kaloudis:zeus:lnsocket) that you can use but we are having issues getting the socket to work. lnmessage has params for `socket` and `tcpSocket` that you should be able to configure and override.

## Point of Sale: Clover integration

Payout: 1,500,000 sats (0.015 BTC)

Currently, the Zeus point of sale only works in tandem with the Square terminal API. We would like to expand support to Clover terminals. Check out the docs for the [Clover REST API](https://docs.clover.com/docs/making-rest-api-calls).

# Claimed Bounties

## Eclair support
Author: [fiatjaf](https://github.com/fiatjaf)

[Pull Request](https://github.com/ZeusLN/zeus/pull/323)

Payout: 1,500,000 sats (0.015 BTC)

Currently, Zeus supports remote connections to lnd, c-lightning (through c-lightning-REST and Spark), and lndhub. We'd like for users to connect to Eclair nodes using the [Eclair REST interface](https://acinq.github.io/eclair/).

## Tor on Android
Author: [gabidi](https://github.com/gabidi/) and [Sifir Apps](https://sifir.io/)

[Pull Request](https://github.com/ZeusLN/zeus/pull/394)

Payout: 21,000,000 sats (0.21 BTC)

Currently, Zeus on Android requires Orbot to connect to your node over the Tor network. We'd like for users to be able to connect to their node over Tor without the use of Orbot, similar to Samourai Wallet. The user should be able to start and stop the Tor process and get a new identity if possible.

Additional bounty patrons: [Capitalist Dog](https://github.com/capitalistdog)

## Tor on iOS
Author: [gabidi](https://github.com/gabidi/) and [Sifir Apps](https://sifir.io/)

[Pull Request](https://github.com/ZeusLN/zeus/pull/394)

Payout: 22,050,000 sats (0.2205 BTC)

Currently, Zeus on iOS cannot connect over Tor. Users looking to connect remotely need a VPN configuration. We'd like for users to be able to connect their node over Tor without the use of another app. The user should be able to start and stop the Tor process and get a new identity if possible.

Additional bounty patrons: [Ben Prentice](https://twitter.com/mrcoolbp), [Capitalist Dog](https://github.com/capitalistdog), anonymous

## lnurl-channel
Author: [pseudozach](https://github.com/pseudozach)

[Pull Request](https://github.com/ZeusLN/zeus/pull/478)

Payout: 500,000 sats (0.005 BTC)

lnurl-channel allows users to have a channel opened to them by scanning a QR code. Some services let you turn a balance into a channel in this manner. Check out the spec [here](https://github.com/fiatjaf/lnurl-rfc/blob/master/lnurl-channel.md).

## lnurl-auth
Author: [pseudozach](https://github.com/pseudozach)

[Pull Request](https://github.com/ZeusLN/zeus/pull/500)

Payout: 1,250,000 sats (0.0125 BTC)

Currently, Zeus supports lnurl-fallback, lnurl-withdraw, and lnurl-pay but not lnurl-auth or lnurl-channel. lnurl-auth will allow users to log into lnurl-auth powered sites using their lightning node. LND doesn't support it natively but it appears Breez has found a workaround - that may be a good starting point. You'll most likely have to leverage Zeus' local database. Check out the spec [here](https://github.com/fiatjaf/lnurl-rfc/blob/master/lnurl-auth.md).

