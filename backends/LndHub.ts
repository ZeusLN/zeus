import LND from './LND';

export class LndHub extends LND {
    getHeaders = (accessToken: string) => {
        if (accessToken) {
            return {
                Authorization: `Bearer ${accessToken}`,
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            };
        }
        return {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        };
    };

    login = (data: LoginRequest) =>
        this.postRequest('/auth?type=auth', {
            login: data.login,
            password: data.password
        });

    getPayments = () => this.getRequest('/gettxs');
    getLightningBalance = () =>
        this.getRequest('/balance').then(({ BTC }) => ({
            balance: BTC.AvailableBalance
        }));
    getInvoices = () => this.getRequest('/getuserinvoices?limit=200');

    createInvoice = (data: any) =>
        this.postRequest('/addinvoice', {
            amt: data.value,
            memo: data.memo
        });
    getNewAddress = () => this.getRequest('/getbtc');
    payLightningInvoice = (data: any) =>
        this.postRequest('/payinvoice', {
            invoice: data.payment_request,
            amount: Number(data.amt && data.amt * 1000)
        });

    supportsOnchainSends = () => false;
    supportsKeysend = () => false;
    supportsChannelManagement = () => false;
    supportsCustomHostProtocol = () => true;
}
