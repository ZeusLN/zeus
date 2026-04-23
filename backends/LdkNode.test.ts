jest.mock('../ldknode/LdkNodeInjection', () => ({
    __esModule: true,
    default: {
        bolt11: {
            sendBolt11: jest.fn(),
            sendBolt11UsingAmount: jest.fn()
        }
    }
}));
jest.mock('../stores/Stores', () => ({
    settingsStore: {
        ldkNetwork: 'mainnet'
    }
}));

import LdkNodeInjection from '../ldknode/LdkNodeInjection';
import LdkNode from './LdkNode';

describe('LdkNode fee limits', () => {
    it('preserves explicit zero fee limits', async () => {
        const node = new LdkNode();
        const sendBolt11Spy = jest
            .spyOn(LdkNodeInjection.bolt11, 'sendBolt11')
            .mockResolvedValue('payment-id');
        jest.spyOn(node as any, 'awaitPaymentCompletion').mockResolvedValue({
            hash: 'payment-hash',
            preimage: 'preimage'
        });

        const response = await node.payLightningInvoice({
            payment_request: 'lnbc1testinvoice',
            timeout_seconds: 120,
            fee_limit_sat: 0
        });

        expect(sendBolt11Spy).toHaveBeenCalledWith({
            invoice: 'lnbc1testinvoice',
            maxTotalRoutingFeeMsat: 0,
            maxPathCount: undefined
        });
        expect(response).toEqual({
            payment_hash: 'payment-hash',
            payment_preimage: 'preimage',
            payment_route: {},
            status: 'SUCCEEDED'
        });
    });
});
