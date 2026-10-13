jest.mock('./utils', () => ({
    sendCommand: jest.fn().mockResolvedValue({ invoices: [] }),
    sendStreamCommand: jest.fn(),
    decodeStreamResult: jest.fn()
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (value: string) => value
}));
jest.mock('../utils/LndMobileUtils', () => ({
    checkLndStreamErrorResponse: jest.fn(),
    LndMobileEventEmitter: { addListener: jest.fn() }
}));

import { sendCommand } from './utils';
import { listInvoices } from './index';

describe('lndmobile.listInvoices', () => {
    it('honors invoice limit and ordering options', async () => {
        await listInvoices({ limit: 10, reversed: false });

        expect(sendCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'ListInvoices',
                options: expect.objectContaining({
                    reversed: false,
                    num_max_invoices: expect.objectContaining({
                        low: 10
                    })
                })
            })
        );
    });
});
