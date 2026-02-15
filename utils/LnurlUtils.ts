import ReactNativeBlobUtil from 'react-native-blob-util';

const DONATION_ADDRESS = 'tips@pay.zeusln.app';

export const loadDonationLnurl = async (
    donationAmount: string
): Promise<string | null> => {
    const [username, bolt11Domain] = DONATION_ADDRESS.split('@');
    const url = bolt11Domain.includes('.onion')
        ? `http://${bolt11Domain}/.well-known/lnurlp/${username.toLowerCase()}`
        : `https://${bolt11Domain}/.well-known/lnurlp/${username.toLowerCase()}`;

    try {
        const response = await ReactNativeBlobUtil.fetch('GET', url);
        const lnurlData = response.json();
        const amount = parseFloat(donationAmount) * 1000;
        const callbackUrl = `${lnurlData.callback}?amount=${amount}`;

        const invoiceResponse = await ReactNativeBlobUtil.fetch(
            'GET',
            callbackUrl
        );
        const invoiceData = invoiceResponse.json();

        return invoiceData.pr;
    } catch (err) {
        console.error('loadLnurl error:', err);
        return null;
    }
};
