const mockPostRequest = jest.fn();

// the handler constructs its CLNRest instance at import time, so postRequest
// has to resolve the mock lazily
jest.mock('./CLNRest', () => ({
    __esModule: true,
    default: class {
        postRequest(...args: Array<any>) {
            return mockPostRequest(...args);
        }
    }
}));
// only used by getChainTransactions, but importing it pulls in the whole
// store graph
jest.mock('../utils/AddressUtils', () => ({ __esModule: true, default: {} }));

import { getUTXOs } from './CoreLightningRequestHandler';

const listfunds = (outputs: Array<any>) => ({ outputs, channels: [] });

const respond = (funds: any, info?: any) =>
    mockPostRequest.mockImplementation((route: string) => {
        if (route === '/v1/listfunds') return Promise.resolve(funds);
        if (route === '/v1/getinfo')
            return info
                ? Promise.resolve(info)
                : Promise.reject(new Error('getinfo failed'));
        return Promise.reject(new Error(`unexpected route ${route}`));
    });

describe('CoreLightningRequestHandler.getUTXOs', () => {
    beforeEach(() => mockPostRequest.mockReset());

    it('derives a confirmation count from the blockheight and the tip', async () => {
        // listfunds outputs carry no confirmations field; before this was
        // normalized every CLN UTXO reported 0 confirmations
        respond(listfunds([{ txid: 'a', blockheight: 108 }]), {
            blockheight: 200
        });

        const { outputs } = await getUTXOs();

        expect(outputs[0].confirmations).toBe(93);
    });

    it('counts the tip block as one confirmation', async () => {
        respond(listfunds([{ txid: 'a', blockheight: 200 }]), {
            blockheight: 200
        });

        const { outputs } = await getUTXOs();

        expect(outputs[0].confirmations).toBe(1);
    });

    it('reports 0 for an output with no blockheight', async () => {
        respond(listfunds([{ txid: 'a', status: 'unconfirmed' }]), {
            blockheight: 200
        });

        const { outputs } = await getUTXOs();

        expect(outputs[0].confirmations).toBe(0);
    });

    it('omits the count when the tip is unknown', async () => {
        respond(listfunds([{ txid: 'a', blockheight: 108 }]));

        const { outputs } = await getUTXOs();

        expect(outputs[0]).not.toHaveProperty('confirmations');
    });

    it('preserves the rest of the listfunds response', async () => {
        respond(
            listfunds([
                {
                    txid: 'a',
                    output: 1,
                    amount_msat: 984857000,
                    blockheight: 108
                }
            ]),
            { blockheight: 200 }
        );

        const { outputs, channels } = await getUTXOs();

        expect(outputs[0]).toMatchObject({
            txid: 'a',
            output: 1,
            amount_msat: 984857000,
            blockheight: 108
        });
        expect(channels).toEqual([]);
    });

    it('rejects when listfunds fails', async () => {
        mockPostRequest.mockImplementation((route: string) =>
            route === '/v1/listfunds'
                ? Promise.reject(new Error('listfunds failed'))
                : Promise.resolve({ blockheight: 200 })
        );

        await expect(getUTXOs()).rejects.toThrow('listfunds failed');
    });
});
