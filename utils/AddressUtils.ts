import { satoshisPerBTC } from './../stores/UnitsStore';
import { DEFAULT_LNDHUB } from '../backends/LndHub';

const btcNonBech = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const btcBech = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,87}$/;

const lnInvoice = /^(lnbcrt|lntb|lnbc|LNBCRT|LNTB|LNBC)([0-9]{1,}[a-zA-Z0-9]+){1}$/;
const lnPubKey = /^[a-f0-9]{66}$/;

/* testnet */
const btcNonBechTestnet = /^[2][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const btcBechTestnet = /^(bc1|bcrt1|[2])[a-zA-HJ-NP-Z0-9]{25,89}$/;
const btcBechPubkeyScriptHashTestnet = /^(tb1|[2])[a-zA-HJ-NP-Z0-9]{25,89}$/;

/* lndhub */
const lndHubAddress = /^(lndhub:\/\/)\w+(:)\w+(@https?:\/\/[\w\.]+(:\d{1,5})?([\/\w]+)?)?$/;

class AddressUtils {
    processSendAddress = (input: string) => {
        let value, amount;

        // handle addresses prefixed with 'bitcoin:' and
        // payment requests prefixed with 'lightning:'

        // handle BTCPay invoices with amounts embedded
        if (input.includes('bitcoin:')) {
            const btcAddressAndParams = input.split('bitcoin:')[1];
            const [btcAddress, params] = btcAddressAndParams.split('?');

            let result: any = {};
            params &&
                params.split('&').forEach(function(part) {
                    const item = part.split('=');
                    result[item[0]] = decodeURIComponent(item[1]);
                });

            value = btcAddress;
            if (result.amount) {
                amount = Number(result.amount) * satoshisPerBTC;
                amount = amount.toString();
            }
        } else if (input.includes('lightning:')) {
            value = input.split('lightning:')[1];
        } else if (input.includes('LIGHTNING:')) {
            value = input.split('LIGHTNING:')[1];
        } else {
            value = input;
        }

        return { value, amount };
    };

    processLNDHubAddress = (input: string) => {
        if (!this.isValidLNDHubAddress(input)) {
            throw new Error('Could not process invalid LNDHub account address');
        }

        input = input.replace('lndhub://', '');
        let value;
        let host;

        if (input.indexOf('@') !== -1) {
            const [namepass, serverURL] = input.split('@');
            value = namepass;
            host = serverURL;
        } else {
            value = input;
            host = DEFAULT_LNDHUB;
        }

        const [username, password] = value.split(':');
        return { username, password, host };
    };

    isValidBitcoinAddress = (input: string, testnet: boolean) => {
        if (testnet) {
            return (
                btcNonBechTestnet.test(input) ||
                btcBechTestnet.test(input) ||
                btcBechPubkeyScriptHashTestnet.test(input)
            );
        }

        return btcNonBech.test(input) || btcBech.test(input);
    };

    isValidLightningPaymentRequest = (input: string) => lnInvoice.test(input);

    isValidLightningPubKey = (input: string) => lnPubKey.test(input);

    isValidLNDHubAddress = (input: string) => lndHubAddress.test(input);
}

const addressUtils = new AddressUtils();
export default addressUtils;
