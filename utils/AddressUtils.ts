const btcNonBech = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const btcBech = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/;
const lnInvoice = /^(lnbcrt|lntb|lnbc)([0-9]{1,}[a-z0-9]+){1}$/;

/* testnet */
const btcNonBechTestnet = /^[2][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const btcBechTestnet = /^(bc1|[2])[a-zA-HJ-NP-Z0-9]{25,39}$/;

class AddressUtils {
    isValidBitcoinAddress = (input: string, testnet: boolean) => {
        if (testnet) {
            return btcNonBechTestnet.test(input) || btcBechTestnet.test(input);
        }

        return btcNonBech.test(input) || btcBech.test(input);
    };

    isValidLightningInvoice = (input: string) => lnInvoice.test(input);
};

const addressUtils = new AddressUtils();
export default addressUtils;