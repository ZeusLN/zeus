import React from 'react';
import { Switch as RNSwitch } from 'react-native';
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
jest.mock('../utils/LnurlFetchUtils', () => ({
    fetchLnurlUrl: jest.fn(() =>
        Promise.resolve({ json: () => ({ status: 'OK' }) })
    )
}));

import { fetchLnurlUrl } from '../utils/LnurlFetchUtils';
import Switch from '../components/Switch';
import LnurlChannel from './LnurlChannel';

const lnurlParams = {
    domain: 'lnurl.example.com',
    k1: 'abc123',
    callback: 'https://lnurl.example.com/channel',
    uri: '03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f@3.33.236.230:9735'
};

const renderView = async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
        tree = renderer.create(
            <LnurlChannel
                navigation={{} as any}
                route={{ params: { lnurlParams } } as any}
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
    const [url] = (fetchLnurlUrl as jest.Mock).mock.calls[0];
    return new URL(url).searchParams;
};

describe('LnurlChannel', () => {
    beforeEach(() => {
        (fetchLnurlUrl as jest.Mock).mockClear();
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
});
