import React from 'react';
import { Alert, Switch as RNSwitch } from 'react-native';
import renderer, { act } from 'react-test-renderer';

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
jest.mock('../components/Button', () => () => null);
jest.mock('../components/LoadingIndicator', () => () => null);
jest.mock('../components/SuccessErrorMessage', () => ({
    SuccessMessage: () => null,
    ErrorMessage: () => null
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => `theme:${key}`)
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../utils/BackendUtils', () => ({
    connectPeer: jest.fn(() => Promise.resolve())
}));
jest.mock('react-native-blob-util', () => ({
    fetch: jest.fn(() => Promise.resolve({ json: () => ({ status: 'OK' }) }))
}));

import ReactNativeBlobUtil from 'react-native-blob-util';
import Button from '../components/Button';
import Switch from '../components/Switch';
import BackendUtils from '../utils/BackendUtils';
import LnurlChannel from './LnurlChannel';

const lnurlParams = {
    domain: 'lnurl.example.com',
    k1: 'abc123',
    callback: 'https://lnurl.example.com/channel',
    uri: '03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f@3.33.236.230:9735'
};

const renderView = async (params: any = lnurlParams) => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
        tree = renderer.create(
            <LnurlChannel
                navigation={{} as any}
                route={{ params: { lnurlParams: params } } as any}
                ChannelsStore={{} as any}
                NodeInfoStore={
                    { nodeInfo: { getPubkey: 'localpubkey' } } as any
                }
            />
        );
    });
    return tree!;
};

const callbackQuery = () => {
    const [, url] = (ReactNativeBlobUtil.fetch as jest.Mock).mock.calls[0];
    return new URL(url).searchParams;
};

describe('LnurlChannel', () => {
    beforeEach(() => {
        (ReactNativeBlobUtil.fetch as jest.Mock).mockClear();
        (BackendUtils.connectPeer as jest.Mock)
            .mockReset()
            .mockImplementation(() => Promise.resolve());
        jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders the themed Switch for the announced toggle', async () => {
        const tree = await renderView();
        const toggle = tree.root.findByType(Switch);
        expect(toggle.props.value).toBe(false);

        const native = tree.root.findByType(RNSwitch);
        expect(native.props.thumbColor).toBe('theme:disabled');
        expect(native.props.trackColor).toEqual({
            false: 'theme:disabled',
            true: 'theme:highlight'
        });
    });

    it('requests a private channel by default', async () => {
        const tree = await renderView();
        await act(async () => {
            tree.root.findByType(LnurlChannel).instance.sendValues();
        });
        expect(callbackQuery().get('private')).toBe('1');
        expect(callbackQuery().get('k1')).toBe('abc123');
        expect(callbackQuery().get('remoteid')).toBe('localpubkey');
    });

    it('requests an announced channel after the toggle is switched on', async () => {
        const tree = await renderView();
        await act(async () => {
            tree.root.findByType(Switch).props.onValueChange(true);
        });
        expect(tree.root.findByType(Switch).props.value).toBe(true);
        expect(tree.root.findByType(RNSwitch).props.thumbColor).toBe(
            'theme:highlight'
        );

        await act(async () => {
            tree.root.findByType(LnurlChannel).instance.sendValues();
        });
        expect(callbackQuery().get('private')).toBe('0');
    });

    describe('Connect', () => {
        const connectButton = (tree: renderer.ReactTestRenderer) =>
            tree.root.findByType(Button);

        const press = async (tree: renderer.ReactTestRenderer) => {
            await act(async () => {
                await connectButton(tree).props.onPress();
            });
        };

        it('does not contact the peer until Connect is pressed', async () => {
            await renderView();
            expect(BackendUtils.connectPeer).not.toHaveBeenCalled();
            expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
        });

        it('connects without persisting, sends the callback, then persists the peer', async () => {
            const tree = await renderView();
            await press(tree);

            const calls = (BackendUtils.connectPeer as jest.Mock).mock.calls;
            expect(calls).toHaveLength(2);
            expect(calls[0][0]).toEqual({
                addr: {
                    pubkey: '03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f',
                    host: '3.33.236.230:9735'
                },
                perm: false
            });
            expect(calls[1][0].perm).toBe(true);
            expect(ReactNativeBlobUtil.fetch).toHaveBeenCalledTimes(1);
            expect(connectButton(tree).props.disabled).toBe(true);
        });

        it('treats an already-connected error as a successful connect', async () => {
            (BackendUtils.connectPeer as jest.Mock).mockImplementationOnce(() =>
                Promise.reject(new Error('already connected to peer'))
            );
            const tree = await renderView();
            await press(tree);

            expect(ReactNativeBlobUtil.fetch).toHaveBeenCalledTimes(1);
        });

        it('stops on a connect error and re-enables the button', async () => {
            (BackendUtils.connectPeer as jest.Mock).mockImplementationOnce(() =>
                Promise.reject(new Error('connection refused'))
            );
            const tree = await renderView();
            await press(tree);

            expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
            expect(BackendUtils.connectPeer).toHaveBeenCalledTimes(1);
            const view = tree.root.findByType(LnurlChannel).instance;
            expect(view.state.errorMsgPeer).toContain('connection refused');
            expect(connectButton(tree).props.disabled).toBe(false);
        });

        it('does not persist the peer when the service rejects the callback', async () => {
            (ReactNativeBlobUtil.fetch as jest.Mock).mockImplementationOnce(
                () =>
                    Promise.resolve({
                        json: () => ({ status: 'ERROR', reason: 'no' })
                    })
            );
            const tree = await renderView();
            await press(tree);

            expect(BackendUtils.connectPeer).toHaveBeenCalledTimes(1);
            expect(Alert.alert).toHaveBeenCalled();
            expect(connectButton(tree).props.disabled).toBe(false);
        });

        it('ignores a second press while the first is in flight', async () => {
            const tree = await renderView();
            await act(async () => {
                const { onPress } = connectButton(tree).props;
                await Promise.all([onPress(), onPress()]);
            });

            expect(ReactNativeBlobUtil.fetch).toHaveBeenCalledTimes(1);
        });

        it('skips the callback when the user backs out during the connect', async () => {
            let resolveConnect: () => void = () => undefined;
            (BackendUtils.connectPeer as jest.Mock).mockImplementationOnce(
                () =>
                    new Promise<void>((resolve) => {
                        resolveConnect = resolve;
                    })
            );
            const tree = await renderView();
            let pending: Promise<void> = Promise.resolve();
            act(() => {
                pending = connectButton(tree).props.onPress();
            });
            act(() => tree.unmount());
            resolveConnect();
            await pending;

            expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
        });

        it('rejects a node URI without a host and disables Connect', async () => {
            const tree = await renderView({
                ...lnurlParams,
                uri: '03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f'
            });

            expect(Alert.alert).toHaveBeenCalledWith(
                'views.LnurlPay.LnurlPay.invalidParams',
                'views.OpenChannel.hostRequired',
                expect.anything(),
                expect.anything()
            );
            expect(connectButton(tree).props.disabled).toBe(true);
        });
    });
});
