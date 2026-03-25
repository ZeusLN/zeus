LND_RELEASE_TAG=$1

echo "LND release tag:" $LND_RELEASE_TAG

# RPC Servers
LND_URL="https://raw.githubusercontent.com/lightningnetwork/lnd"

# remove old protos
rm -rf protos

# download new protos
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/lightning.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/lightning.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/walletunlocker.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/walletunlocker.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/stateservice.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/stateservice.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/autopilotrpc/autopilot.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/autopilotrpc/autopilot.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/chainrpc/chainnotifier.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/chainrpc/chainnotifier.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/invoicesrpc/invoices.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/invoicesrpc/invoices.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/peersrpc/peers.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/peersrpc/peers.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/routerrpc/router.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/routerrpc/router.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/signrpc/signer.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/signrpc/signer.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/walletrpc/walletkit.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/walletrpc/walletkit.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/watchtowerrpc/watchtower.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/watchtowerrpc/watchtower.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/wtclientrpc/wtclient.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/wtclientrpc/wtclient.proto
