import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../components/Header', () => () => null);
jest.mock('../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <Pressable role="button" onPress={onPress} disabled={disabled}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../components/LoadingIndicator', () => () => null);
jest.mock('../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        SuccessMessage: ({ message }: any) => <Text>{message}</Text>,
        ErrorMessage: ({ message }: any) => <Text>{message}</Text>
    };
});
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => `theme:${key}`)
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/BackendUtils', () => ({
    connectPeer: jest.fn()
}));
jest.mock('react-native-blob-util', () => ({
    fetch: jest.fn()
}));

import ReactNativeBlobUtil from 'react-native-blob-util';
import BackendUtils from '../utils/BackendUtils';
import LnurlChannel from './LnurlChannel';

const PUBKEY =
    '03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f';
const lnurlParams = {
    domain: 'lnurl.example.com',
    k1: 'abc123',
    callback: 'https://lnurl.example.com/channel',
    uri: `${PUBKEY}@3.33.236.230:9735`
};

const connectPeer = BackendUtils.connectPeer as jest.Mock;
const blobFetch = ReactNativeBlobUtil.fetch as jest.Mock;

const renderView = (params: any = lnurlParams) =>
    render(
        <LnurlChannel
            navigation={{} as any}
            route={{ params: { lnurlParams: params } } as any}
            ChannelsStore={{} as any}
            NodeInfoStore={{ nodeInfo: { getPubkey: 'localpubkey' } } as any}
        />
    );

const connectButton = () =>
    screen.getByRole('button', { name: 'views.LnurlChannel.connect' });

const pressConnect = () => fireEvent.press(connectButton());

// Lets the act() inside an unawaited fireEvent finish. Another act() here
// would overlap it.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const callbackQuery = () => {
    const [, url] = blobFetch.mock.calls[0];
    return new URL(url).searchParams;
};

describe('LnurlChannel', () => {
    beforeEach(() => {
        connectPeer.mockReset().mockResolvedValue(undefined);
        blobFetch
            .mockReset()
            .mockResolvedValue({ json: () => ({ status: 'OK' }) });
        jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders the themed Switch for the announced toggle, off', async () => {
        await renderView();
        const toggle = screen.getByRole('switch');
        expect(toggle).not.toBeChecked();
        expect(toggle).toHaveProp('thumbTintColor', 'theme:disabled');
        expect(toggle).toHaveProp('tintColor', 'theme:disabled');
        expect(toggle).toHaveProp('onTintColor', 'theme:highlight');
    });

    it('requests a private channel by default', async () => {
        await renderView();
        await pressConnect();
        expect(callbackQuery().get('private')).toBe('1');
        expect(callbackQuery().get('k1')).toBe('abc123');
        expect(callbackQuery().get('remoteid')).toBe('localpubkey');
    });

    it('requests an announced channel after the toggle is switched on', async () => {
        await renderView();
        await fireEvent(screen.getByRole('switch'), 'change', {
            nativeEvent: { value: true }
        });
        expect(screen.getByRole('switch')).toBeChecked();
        expect(screen.getByRole('switch')).toHaveProp(
            'thumbTintColor',
            'theme:highlight'
        );

        await pressConnect();
        expect(callbackQuery().get('private')).toBe('0');
    });

    describe('Connect', () => {
        it('does not contact the peer until Connect is pressed', async () => {
            await renderView();
            expect(connectPeer).not.toHaveBeenCalled();
            expect(blobFetch).not.toHaveBeenCalled();
            expect(connectButton()).toBeEnabled();
        });

        it('connects without persisting, sends the callback, then persists the peer', async () => {
            await renderView();
            await pressConnect();

            expect(connectPeer.mock.calls).toEqual([
                [
                    {
                        addr: { pubkey: PUBKEY, host: '3.33.236.230:9735' },
                        perm: false
                    }
                ],
                [
                    {
                        addr: { pubkey: PUBKEY, host: '3.33.236.230:9735' },
                        perm: true
                    }
                ]
            ]);
            expect(blobFetch).toHaveBeenCalledTimes(1);
            expect(
                screen.getByText('views.LnurlChannel.success')
            ).toBeOnTheScreen();
            // the request succeeded, so Connect stays disabled
            expect(connectButton()).toBeDisabled();
        });

        it('keeps Connect disabled and sends nothing while the connect is pending', async () => {
            let connected!: () => void;
            connectPeer.mockReturnValueOnce(
                new Promise<void>((resolve) => {
                    connected = resolve;
                })
            );
            await renderView();
            // fireEvent waits for the press handler, which waits on the
            // connect, so the press is not awaited until it is released
            const press = pressConnect();
            await tick();

            expect(connectButton()).toBeDisabled();
            await fireEvent.press(connectButton());
            expect(connectPeer).toHaveBeenCalledTimes(1);
            expect(blobFetch).not.toHaveBeenCalled();

            connected();
            await press;
            expect(blobFetch).toHaveBeenCalledTimes(1);
        });

        it('treats an already-connected error as a successful connect', async () => {
            connectPeer.mockRejectedValueOnce(
                new Error('already connected to peer')
            );
            await renderView();
            await pressConnect();

            expect(blobFetch).toHaveBeenCalledTimes(1);
        });

        it('stops on a connect error, shows it and re-enables the button', async () => {
            connectPeer.mockRejectedValueOnce(new Error('connection refused'));
            await renderView();
            await pressConnect();

            expect(blobFetch).not.toHaveBeenCalled();
            expect(connectPeer).toHaveBeenCalledTimes(1);
            expect(
                screen.getByText('Error: connection refused')
            ).toBeOnTheScreen();
            expect(connectButton()).toBeEnabled();
        });

        it('does not persist the peer when the service rejects the callback', async () => {
            blobFetch.mockResolvedValueOnce({
                json: () => ({ status: 'ERROR', reason: 'no' })
            });
            await renderView();
            await pressConnect();

            expect(connectPeer).toHaveBeenCalledTimes(1);
            expect(Alert.alert).toHaveBeenCalled();
            expect(connectButton()).toBeEnabled();
        });

        it('skips the callback when the user backs out during the connect', async () => {
            let connected!: () => void;
            connectPeer.mockReturnValueOnce(
                new Promise<void>((resolve) => {
                    connected = resolve;
                })
            );
            const { unmount } = await renderView();
            const press = pressConnect();
            await tick();
            await unmount();
            connected();
            await press;

            expect(blobFetch).not.toHaveBeenCalled();
        });

        it('rejects a node URI without a host and disables Connect', async () => {
            await renderView({ ...lnurlParams, uri: PUBKEY });

            expect(Alert.alert).toHaveBeenCalledWith(
                'views.LnurlPay.LnurlPay.invalidParams',
                'views.OpenChannel.hostRequired',
                expect.anything(),
                expect.anything()
            );
            expect(connectButton()).toBeDisabled();
        });
    });
});
