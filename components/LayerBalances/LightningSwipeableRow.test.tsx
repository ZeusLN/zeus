jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('js-lnurl', () => ({ getParams: jest.fn() }));
jest.mock('react-native-blob-util', () => ({}));
// clearnet lookups go through the redirect-checking fetch
const mockFetchLnurlUrl = jest.fn();
jest.mock('../../utils/LnurlFetchUtils', () => ({
    ...jest.requireActual('../../utils/LnurlFetchUtils'),
    fetchLnurlUrl: (...args: any[]) => mockFetchLnurlUrl(...args)
}));
const mockDoTorRequest = jest.fn();
jest.mock('../../utils/TorUtils', () => ({
    doTorRequest: (...args: any[]) => mockDoTorRequest(...args),
    RequestMethod: { GET: 'GET' }
}));
jest.mock('../../utils/BackendUtils', () => ({
    supportsCashuWallet: () => false
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#ffffff' }));
jest.mock('../../stores/Stores', () => ({
    modalStore: {},
    invoicesStore: {},
    nodeInfoStore: {},
    settingsStore: {}
}));
jest.mock('../../stores/SyncStore', () => ({}));
jest.mock('./SwipeableRowAction', () => 'SwipeableRowAction');
jest.mock('./SwipeableRowContainer', () => 'SwipeableRowContainer');

import * as React from 'react';
import { Alert, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { settingsStore } from '../../stores/Stores';
import { unsafeLnurlError } from '../../utils/LnurlFetchUtils';
import LightningSwipeableRow from './LightningSwipeableRow';

const mockSettingsStore = settingsStore as {
    enableTor?: boolean;
    settings?: any;
};

const ONION = 'zeuspayzeuspayzeuspayzeuspayzeuspayzeuspayzeuspayzeus.onion';

// A locked row pays its destination when tapped
const tapRow = async (lightningAddress: string) => {
    const navigation = { navigate: jest.fn() };
    await render(
        <LightningSwipeableRow
            {...({
                lightningAddress,
                locked: true,
                navigation,
                SyncStore: { isSyncing: false }
            } as any)}
        >
            <Text>Pay</Text>
        </LightningSwipeableRow>
    );
    await fireEvent.press(screen.getByText('Pay'));
    // the lookup is started but not awaited by the press handler
    await new Promise(setImmediate);
    return navigation;
};

describe('LightningSwipeableRow Lightning Address lookup', () => {
    beforeEach(() => {
        mockFetchLnurlUrl.mockReset();
        mockFetchLnurlUrl.mockResolvedValue({
            info: () => ({ status: 200 }),
            json: () => ({ callback: 'https://example.com/callback' })
        });
        mockDoTorRequest.mockReset();
        mockDoTorRequest.mockResolvedValue({
            callback: `http://${ONION}/callback`
        });
        mockSettingsStore.enableTor = false;
        mockSettingsStore.settings = {};
    });

    it('lowercases an uppercase domain and username', async () => {
        const navigation = await tapRow('SATOSHI@BLINK.SV');

        expect(mockFetchLnurlUrl).toHaveBeenCalledWith(
            'https://blink.sv/.well-known/lnurlp/satoshi'
        );
        expect(navigation.navigate).toHaveBeenCalledWith(
            'LnurlPay',
            expect.objectContaining({ lightningAddress: 'SATOSHI@BLINK.SV' })
        );
    });

    it('keeps the username casing for cryptoqr.net', async () => {
        const username = 'https%3A%2F%2Fpay.cryptoqr.net%2F3458967';

        await tapRow(`${username}@cryptoqr.net`);

        expect(mockFetchLnurlUrl).toHaveBeenCalledWith(
            `https://cryptoqr.net/.well-known/lnurlp/${username}`
        );
    });

    it('routes an uppercase .onion address through Tor', async () => {
        mockSettingsStore.enableTor = true;

        const navigation = await tapRow(`SATOSHI@${ONION.toUpperCase()}`);

        expect(mockDoTorRequest).toHaveBeenCalledWith(
            `http://${ONION}/.well-known/lnurlp/satoshi`,
            'GET'
        );
        expect(mockFetchLnurlUrl).not.toHaveBeenCalled();
        expect(navigation.navigate).toHaveBeenCalledWith(
            'LnurlPay',
            expect.anything()
        );
    });

    it('does not use Tor for an .onion address while Tor is off', async () => {
        await tapRow(`satoshi@${ONION}`);

        expect(mockDoTorRequest).not.toHaveBeenCalled();
        expect(mockFetchLnurlUrl).toHaveBeenCalledWith(
            `http://${ONION}/.well-known/lnurlp/satoshi`
        );
    });

    it('fetches a clearnet domain with an .onion label over https', async () => {
        mockSettingsStore.enableTor = true;

        await tapRow('satoshi@pay.onion.example.com');

        expect(mockDoTorRequest).not.toHaveBeenCalled();
        expect(mockFetchLnurlUrl).toHaveBeenCalledWith(
            'https://pay.onion.example.com/.well-known/lnurlp/satoshi'
        );
    });

    describe('lookup failures', () => {
        let alertSpy: jest.SpyInstance;
        beforeEach(() => {
            alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        });
        afterEach(() => alertSpy.mockRestore());

        const alertedMessage = () => alertSpy.mock.calls[0]?.[1];

        it('alerts when the response has no callback', async () => {
            mockFetchLnurlUrl.mockResolvedValue({
                info: () => ({ status: 200 }),
                json: () => ({})
            });

            const navigation = await tapRow('satoshi@domain.com');

            expect(alertedMessage()).toBe(
                'utils.handleAnything.lightningAddressError'
            );
            expect(navigation.navigate).not.toHaveBeenCalled();
        });

        it('alerts on a non-200 response', async () => {
            mockFetchLnurlUrl.mockResolvedValue({
                info: () => ({ status: 404 }),
                json: () => ({ callback: 'https://example.com/callback' })
            });

            const navigation = await tapRow('satoshi@domain.com');

            expect(alertedMessage()).toBe(
                'utils.handleAnything.lightningAddressError'
            );
            expect(navigation.navigate).not.toHaveBeenCalled();
        });

        it('alerts when the redirect limit is hit', async () => {
            mockFetchLnurlUrl.mockRejectedValue(
                new Error('utils.lnurl.tooManyRedirects')
            );

            const navigation = await tapRow('satoshi@domain.com');

            expect(alertedMessage()).toBe('utils.lnurl.tooManyRedirects');
            expect(navigation.navigate).not.toHaveBeenCalled();
        });

        it('alerts when a redirect is refused by the host policy', async () => {
            mockFetchLnurlUrl.mockRejectedValue(
                unsafeLnurlError('utils.lnurl.unsafeRedirect')
            );

            const navigation = await tapRow('satoshi@domain.com');

            expect(alertedMessage()).toBe('utils.lnurl.unsafeRedirect');
            expect(navigation.navigate).not.toHaveBeenCalled();
        });

        it('alerts when the request fails', async () => {
            mockFetchLnurlUrl.mockRejectedValue(new Error('network down'));

            const navigation = await tapRow('satoshi@domain.com');

            expect(alertedMessage()).toBe('network down');
            expect(navigation.navigate).not.toHaveBeenCalled();
        });

        it('alerts when a Tor response has no callback', async () => {
            mockSettingsStore.enableTor = true;
            mockDoTorRequest.mockResolvedValue({});

            const navigation = await tapRow(`satoshi@${ONION}`);

            expect(alertedMessage()).toBe(
                'utils.handleAnything.lightningAddressError'
            );
            expect(navigation.navigate).not.toHaveBeenCalled();
        });

        // doTorRequest can reject with a non-Error value
        it('falls back to the generic message for a Tor rejection without a message', async () => {
            mockSettingsStore.enableTor = true;
            mockDoTorRequest.mockRejectedValue('socks failure');

            const navigation = await tapRow(`satoshi@${ONION}`);

            expect(alertedMessage()).toBe(
                'utils.handleAnything.lightningAddressError'
            );
            expect(navigation.navigate).not.toHaveBeenCalled();
        });
    });
});
