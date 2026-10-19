jest.mock('react-native', () => ({
    NativeModules: {
        LndMobile: {
            sendStreamCommand: jest.fn(),
            sendBidiStreamCommand: jest.fn()
        }
    }
}));

import { NativeModules } from 'react-native';
import { lnrpc } from '../proto/lightning';
import { sendBidiStreamCommand, sendStreamCommand } from './utils';

const LndMobile = NativeModules.LndMobile as unknown as {
    sendStreamCommand: jest.Mock;
    sendBidiStreamCommand: jest.Mock;
};

beforeEach(() => {
    jest.clearAllMocks();
    LndMobile.sendStreamCommand.mockResolvedValue('done');
    LndMobile.sendBidiStreamCommand.mockResolvedValue('done');
});

describe('sendStreamCommand', () => {
    const command = (requestId?: string) =>
        sendStreamCommand(
            {
                request: lnrpc.InvoiceSubscription,
                method: 'SubscribeInvoices',
                options: {},
                requestId
            },
            true
        );

    it('passes the request id as the last native argument', async () => {
        await expect(command('request-1')).resolves.toBe('done');

        expect(LndMobile.sendStreamCommand).toHaveBeenCalledWith(
            'SubscribeInvoices',
            '',
            true,
            'request-1'
        );
    });

    it('passes an empty request id when none is given', async () => {
        await command();

        expect(LndMobile.sendStreamCommand).toHaveBeenCalledWith(
            'SubscribeInvoices',
            '',
            true,
            ''
        );
    });
});

describe('sendBidiStreamCommand', () => {
    it('passes the request id as the last native argument', async () => {
        await expect(
            sendBidiStreamCommand('ChannelAcceptor', false, 'request-2')
        ).resolves.toBe('done');

        expect(LndMobile.sendBidiStreamCommand).toHaveBeenCalledWith(
            'ChannelAcceptor',
            false,
            'request-2'
        );
    });

    it('passes an empty request id when none is given', async () => {
        await sendBidiStreamCommand('ChannelAcceptor');

        expect(LndMobile.sendBidiStreamCommand).toHaveBeenCalledWith(
            'ChannelAcceptor',
            false,
            ''
        );
    });
});
