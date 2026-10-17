jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('js-lnurl', () => ({ getParams: jest.fn() }));
const mockBlobUtilFetch = jest.fn();
jest.mock('react-native-blob-util', () => ({
    fetch: (...args: any[]) => mockBlobUtilFetch(...args)
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
import { getParams as getlnurlParams } from 'js-lnurl';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { settingsStore } from '../../stores/Stores';
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
        mockBlobUtilFetch.mockReset();
        mockBlobUtilFetch.mockResolvedValue({
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

        expect(mockBlobUtilFetch).toHaveBeenCalledWith(
            'get',
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

        expect(mockBlobUtilFetch).toHaveBeenCalledWith(
            'get',
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
        expect(mockBlobUtilFetch).not.toHaveBeenCalled();
        expect(navigation.navigate).toHaveBeenCalledWith(
            'LnurlPay',
            expect.anything()
        );
    });

    it('does not use Tor for an .onion address while Tor is off', async () => {
        await tapRow(`satoshi@${ONION}`);

        expect(mockDoTorRequest).not.toHaveBeenCalled();
        expect(mockBlobUtilFetch).toHaveBeenCalledWith(
            'get',
            `http://${ONION}/.well-known/lnurlp/satoshi`
        );
    });

    it('fetches a clearnet domain with an .onion label over https', async () => {
        mockSettingsStore.enableTor = true;

        await tapRow('satoshi@pay.onion.example.com');

        expect(mockDoTorRequest).not.toHaveBeenCalled();
        expect(mockBlobUtilFetch).toHaveBeenCalledWith(
            'get',
            'https://pay.onion.example.com/.well-known/lnurlp/satoshi'
        );
    });

    // fetchLnInvoice neither awaits nor catches the lookup, so a server
    // without a callback ends up as an unhandled rejection and the user sees
    // nothing. Jest fails a test on an unhandled rejection, so this cannot be
    // pinned through the row until the error is handled (#5060).
    it.todo('tells the user when the Lightning address lookup fails');

    describe('handler validation', () => {
        // Until #5060 lands, call the handler on a mounted row directly
        const lookUp = async (lightningAddress: string) => {
            const ref = React.createRef<any>();
            const navigation = { navigate: jest.fn() };
            await render(
                <LightningSwipeableRow
                    {...({
                        ref,
                        lightningAddress,
                        locked: true,
                        navigation,
                        SyncStore: { isSyncing: false }
                    } as any)}
                >
                    <Text>Pay</Text>
                </LightningSwipeableRow>
            );
            const result = ref.current.handleLightningAddress(
                lightningAddress,
                navigation,
                {}
            );
            return { navigation, result };
        };

        it('rejects a response without a callback', async () => {
            mockBlobUtilFetch.mockResolvedValue({
                info: () => ({ status: 200 }),
                json: () => ({})
            });

            const { navigation, result } = await lookUp('satoshi@domain.com');

            await expect(result).rejects.toThrow(
                'utils.handleAnything.lightningAddressError'
            );
            expect(navigation.navigate).not.toHaveBeenCalled();
        });

        it('rejects a non-200 response', async () => {
            mockBlobUtilFetch.mockResolvedValue({
                info: () => ({ status: 404 }),
                json: () => ({ callback: 'https://example.com/callback' })
            });

            const { navigation, result } = await lookUp('satoshi@domain.com');

            await expect(result).rejects.toThrow(
                'utils.handleAnything.lightningAddressError'
            );
            expect(navigation.navigate).not.toHaveBeenCalled();
        });

        it('rejects a Tor response without a callback', async () => {
            mockSettingsStore.enableTor = true;
            mockDoTorRequest.mockResolvedValue({});

            const { navigation, result } = await lookUp(`satoshi@${ONION}`);

            await expect(result).rejects.toThrow(
                'utils.handleAnything.lightningAddressError'
            );
            expect(navigation.navigate).not.toHaveBeenCalled();
        });
    });
});

describe('LightningSwipeableRow LNURL errors', () => {
    it('names the host the LNURL error came from', async () => {
        const alertSpy = jest
            .spyOn(Alert, 'alert')
            .mockImplementation(() => {});
        (getlnurlParams as jest.Mock).mockResolvedValue({
            status: 'ERROR',
            reason: 'Claim your refund',
            // js-lnurl's getDomain reads shop.example out of this URL
            domain: 'shop.example',
            url: 'https://other.example\\@shop.example/lnurl'
        });
        await render(
            <LightningSwipeableRow
                {...({
                    lightning: 'lnurl1example',
                    locked: true,
                    navigation: { navigate: jest.fn() },
                    SyncStore: { isSyncing: false }
                } as any)}
            >
                <Text>Pay</Text>
            </LightningSwipeableRow>
        );
        await fireEvent.press(screen.getByText('Pay'));
        await new Promise(setImmediate);

        expect(alertSpy).toHaveBeenCalledWith(
            'general.error',
            'other.example says: Claim your refund',
            expect.any(Array),
            { cancelable: false }
        );
        alertSpy.mockRestore();
    });
});
