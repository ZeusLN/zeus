import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

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
jest.mock('../components/SuccessErrorMessage', () => ({
    SuccessMessage: () => null,
    ErrorMessage: () => null
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => `theme:${key}`)
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/BackendUtils', () => ({
    connectPeer: jest.fn(() => Promise.resolve())
}));
jest.mock('../utils/LnurlFetchUtils', () => ({
    fetchLnurlUrl: jest.fn(() =>
        Promise.resolve({ json: () => ({ status: 'OK' }) })
    )
}));

import { fetchLnurlUrl } from '../utils/LnurlFetchUtils';
import BackendUtils from '../utils/BackendUtils';
import LnurlChannel from './LnurlChannel';

const lnurlParams = {
    domain: 'lnurl.example.com',
    k1: 'abc123',
    callback: 'https://lnurl.example.com/channel',
    uri: '03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f@3.33.236.230:9735'
};

const renderView = () =>
    render(
        <LnurlChannel
            navigation={{} as any}
            route={{ params: { lnurlParams } } as any}
            ChannelsStore={{} as any}
            NodeInfoStore={{ nodeInfo: { getPubkey: 'localpubkey' } } as any}
        />
    );

const connectButton = () =>
    screen.getByRole('button', { name: 'views.LnurlChannel.connect' });

const callbackQuery = () => {
    const [url] = (fetchLnurlUrl as jest.Mock).mock.calls[0];
    return new URL(url).searchParams;
};

describe('LnurlChannel', () => {
    beforeEach(() => {
        (fetchLnurlUrl as jest.Mock).mockClear();
        (BackendUtils.connectPeer as jest.Mock).mockClear();
    });

    it('connects to the peer on mount and then enables Connect', async () => {
        await renderView();
        expect(BackendUtils.connectPeer).toHaveBeenCalledWith({
            addr: {
                pubkey: '03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f',
                host: '3.33.236.230:9735'
            }
        });
        expect(connectButton()).toBeEnabled();
    });

    it('keeps Connect disabled until the peer connection resolves', async () => {
        let connected!: () => void;
        (BackendUtils.connectPeer as jest.Mock).mockReturnValueOnce(
            new Promise<void>((resolve) => {
                connected = resolve;
            })
        );
        await renderView();

        expect(connectButton()).toBeDisabled();
        await fireEvent.press(connectButton());
        expect(fetchLnurlUrl).not.toHaveBeenCalled();

        await act(async () => connected());
        expect(connectButton()).toBeEnabled();
        await fireEvent.press(connectButton());
        expect(fetchLnurlUrl).toHaveBeenCalledTimes(1);
    });

    it('keeps Connect disabled when the peer connection fails', async () => {
        (BackendUtils.connectPeer as jest.Mock).mockRejectedValueOnce(
            new Error('peer unreachable')
        );
        await renderView();
        expect(connectButton()).toBeDisabled();
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
        await fireEvent.press(connectButton());
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

        await fireEvent.press(connectButton());
        expect(callbackQuery().get('private')).toBe('0');
    });
});
