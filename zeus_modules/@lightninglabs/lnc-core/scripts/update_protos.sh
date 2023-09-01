LND_RELEASE_TAG=$1
LOOP_RELEASE_TAG=$2
POOL_RELEASE_TAG=$3
FARADAY_RELEASE_TAG=$4
TAPD_RELEASE_TAG=$5
LIT_RELEASE_TAG=$6

echo "LND release tag:" $LND_RELEASE_TAG
echo "Loop release tag:" $LOOP_RELEASE_TAG
echo "Pool release tag:" $POOL_RELEASE_TAG
echo "Faraday release tag:" $FARADAY_RELEASE_TAG
echo "Taproot Assets release tag:" $TAPD_RELEASE_TAG
echo "LiT release tag:" $LIT_RELEASE_TAG

# RPC Servers
LND_URL="https://raw.githubusercontent.com/lightningnetwork/lnd"
LOOP_URL="https://raw.githubusercontent.com/lightninglabs/loop"
POOL_URL="https://raw.githubusercontent.com/lightninglabs/pool"
FARADAY_URL="https://raw.githubusercontent.com/lightninglabs/faraday"
TAPD_URL="https://raw.githubusercontent.com/lightninglabs/taproot-assets"
LIT_URL="https://raw.githubusercontent.com/lightninglabs/lightning-terminal"

# remove old protos
rm -rf protos

# download new protos
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/lightning.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/lightning.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/walletunlocker.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/walletunlocker.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/autopilotrpc/autopilot.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/autopilotrpc/autopilot.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/chainrpc/chainnotifier.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/chainrpc/chainnotifier.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/invoicesrpc/invoices.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/invoicesrpc/invoices.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/routerrpc/router.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/routerrpc/router.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/signrpc/signer.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/signrpc/signer.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/walletrpc/walletkit.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/walletrpc/walletkit.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/watchtowerrpc/watchtower.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/watchtowerrpc/watchtower.proto
curl ${LND_URL}/${LND_RELEASE_TAG}/lnrpc/wtclientrpc/wtclient.proto --create-dirs -o protos/lnd/${LND_RELEASE_TAG}/wtclientrpc/wtclient.proto

curl ${LOOP_URL}/${LOOP_RELEASE_TAG}/looprpc/client.proto --create-dirs -o protos/loop/${LOOP_RELEASE_TAG}/client.proto
curl ${LOOP_URL}/${LOOP_RELEASE_TAG}/looprpc/debug.proto --create-dirs -o protos/loop/${LOOP_RELEASE_TAG}/debug.proto
curl ${LOOP_URL}/${LOOP_RELEASE_TAG}/swapserverrpc/common.proto --create-dirs -o protos/loop/${LOOP_RELEASE_TAG}/swapserverrpc/common.proto
curl ${LOOP_URL}/${LOOP_RELEASE_TAG}/swapserverrpc/server.proto --create-dirs -o protos/loop/${LOOP_RELEASE_TAG}/swapserverrpc/server.proto

curl ${POOL_URL}/${POOL_RELEASE_TAG}/poolrpc/trader.proto --create-dirs -o protos/pool/${POOL_RELEASE_TAG}/trader.proto
curl ${POOL_URL}/${POOL_RELEASE_TAG}/auctioneerrpc/auctioneer.proto --create-dirs -o protos/pool/${POOL_RELEASE_TAG}/auctioneerrpc/auctioneer.proto
curl ${POOL_URL}/${POOL_RELEASE_TAG}/auctioneerrpc/hashmail.proto --create-dirs -o protos/pool/${POOL_RELEASE_TAG}/auctioneerrpc/hashmail.proto

curl ${FARADAY_URL}/${FARADAY_RELEASE_TAG}/frdrpc/faraday.proto --create-dirs -o protos/faraday/${FARADAY_RELEASE_TAG}/faraday.proto

curl ${TAPD_URL}/${TAPD_RELEASE_TAG}/taprpc/taprootassets.proto --create-dirs -o protos/tapd/${TAPD_RELEASE_TAG}/taprootassets.proto
curl ${TAPD_URL}/${TAPD_RELEASE_TAG}/taprpc/assetwalletrpc/assetwallet.proto --create-dirs -o protos/tapd/${TAPD_RELEASE_TAG}/assetwalletrpc/assetwallet.proto
curl ${TAPD_URL}/${TAPD_RELEASE_TAG}/taprpc/mintrpc/mint.proto --create-dirs -o protos/tapd/${TAPD_RELEASE_TAG}/mintrpc/mint.proto
curl ${TAPD_URL}/${TAPD_RELEASE_TAG}/taprpc/universerpc/universe.proto --create-dirs -o protos/tapd/${TAPD_RELEASE_TAG}/universerpc/universe.proto

curl ${LIT_URL}/${LIT_RELEASE_TAG}/litrpc/firewall.proto --create-dirs -o protos/lit/${LIT_RELEASE_TAG}/firewall.proto
curl ${LIT_URL}/${LIT_RELEASE_TAG}/litrpc/lit-sessions.proto --create-dirs -o protos/lit/${LIT_RELEASE_TAG}/lit-sessions.proto
curl ${LIT_URL}/${LIT_RELEASE_TAG}/litrpc/lit-autopilot.proto --create-dirs -o protos/lit/${LIT_RELEASE_TAG}/lit-autopilot.proto
