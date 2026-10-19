jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
// the request fetchLnurlUrl sends for each hop
const mockFetch = jest.fn();
jest.mock('react-native-blob-util', () => ({
    config: () => ({ fetch: (...args: any[]) => mockFetch(...args) })
}));
// the lnurl resolve behind getLnurlParams
const mockFetchLnurlParams = jest.fn();
jest.mock('../../utils/LnurlFetchUtils', () => ({
    ...jest.requireActual('../../utils/LnurlFetchUtils'),
    fetchLnurlParams: (...args: any[]) => mockFetchLnurlParams(...args)
}));
jest.mock('../../utils/BackendUtils', () => ({
    supportsCoinControl: () => false
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#ffffff' }));
jest.mock('../../stores/Stores', () => ({ cashuStore: {} }));
jest.mock('../../stores/SyncStore', () => ({}));
jest.mock('./SwipeableRowAction', () => 'SwipeableRowAction');
jest.mock('./SwipeableRowContainer', () => 'SwipeableRowContainer');

import * as React from 'react';
import { Alert, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { bech32 } from 'bech32';
import Base64Utils from '../../utils/Base64Utils';
import EcashSwipeableRow from './EcashSwipeableRow';

const asLnurl = (target: string) =>
    bech32.encode(
        'lnurl',
        bech32.toWords(Base64Utils.utf8ToBytes(target)),
        20000
    );

// A locked row pays its destination when tapped
const tapRow = (lightning: string) => tapRowWith({ lightning });

const tapRowWith = async (destination: any) => {
    const navigation = { navigate: jest.fn() };
    await render(
        <EcashSwipeableRow
            {...({
                ...destination,
                locked: true,
                navigation,
                SyncStore: { isSyncing: false }
            } as any)}
        >
            <Text>Pay</Text>
        </EcashSwipeableRow>
    );
    await fireEvent.press(screen.getByText('Pay'));
    // the resolve is started but not awaited by the press handler
    await new Promise(setImmediate);
    return navigation;
};

// A BIP21 lightning= lnurl reaches the row without passing through
// handleAnything, so the row's own resolve is the only policy check
describe('EcashSwipeableRow lnurl resolve', () => {
    let alertSpy: jest.SpyInstance;

    beforeEach(() => {
        mockFetchLnurlParams.mockReset();
        alertSpy = jest.spyOn(Alert, 'alert').mockImplementation();
    });

    afterEach(() => alertSpy.mockRestore());

    const expectAlert = (message: string) =>
        expect(alertSpy).toHaveBeenCalledWith(
            'general.error',
            message,
            expect.anything(),
            expect.anything()
        );

    it('opens ReceiveEcash for a public withdraw', async () => {
        const params = {
            tag: 'withdrawRequest',
            k1: 'k1',
            callback: 'https://example.com/cb'
        };
        mockFetchLnurlParams.mockResolvedValue(params);

        const navigation = await tapRow(asLnurl('https://example.com/lnurl'));

        expect(navigation.navigate).toHaveBeenCalledWith('ReceiveEcash', {
            lnurlParams: params
        });
        expect(alertSpy).not.toHaveBeenCalled();
    });

    it('refuses an lnurl on a private host without resolving it', async () => {
        const navigation = await tapRow(asLnurl('https://192.168.1.1/lnurl'));

        expectAlert('utils.lnurl.unsafeEndpoint');
        expect(mockFetchLnurlParams).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('refuses a withdraw whose callback is on a private host', async () => {
        mockFetchLnurlParams.mockResolvedValue({
            tag: 'withdrawRequest',
            k1: 'k1',
            callback: 'https://10.0.0.1/cb'
        });

        const navigation = await tapRow(asLnurl('https://example.com/lnurl'));

        expectAlert('utils.lnurl.unsafeCallback');
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    // js-lnurl throws this for a withdraw link with a repeated callback=
    it('shows the generic message, not the raw error, for a malformed link', async () => {
        mockFetchLnurlParams.mockRejectedValue(
            new TypeError('url.split is not a function')
        );

        const navigation = await tapRow(asLnurl('https://example.com/lnurl'));

        expectAlert('utils.handleAnything.invalidLnurlParams');
        expect(navigation.navigate).not.toHaveBeenCalled();
    });
});

describe('EcashSwipeableRow LNURL errors', () => {
    let alertSpy: jest.SpyInstance;

    const alertedMessage = () => alertSpy.mock.calls[0]?.[1];

    beforeEach(() => {
        mockFetch.mockReset();
        // resolve for real, over the mocked request
        mockFetchLnurlParams.mockImplementation(
            jest.requireActual('../../utils/LnurlFetchUtils').fetchLnurlParams
        );
        alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    afterEach(() => alertSpy.mockRestore());

    // #5060: this error used to end up as an unhandled rejection
    it('alerts on an .onion LNURL error response', async () => {
        // the row is only tappable with a lightning value
        const navigation = await tapRowWith({
            lightning: asLnurl('http://example.onion/lnurl'),
            // js-lnurl's error responses carry the request URL, which the
            // row names the host from
            lnurlParams: {
                status: 'ERROR',
                domain: 'example.onion',
                url: 'http://example.onion/lnurl',
                reason: 'unreachable'
            }
        });

        expect(alertedMessage()).toBe('example.onion says: unreachable');
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    // decode-uri-component's `$\`` / `$'` blowup (#4553). The resolve
    // refuses the query before any request; the row shows the same message
    // handleAnything does, not the raw URIError.
    it('alerts that a LNURL with an undecodable query is invalid', async () => {
        const query = '%24%60x%24%27y'.repeat(100) + '%';

        const navigation = await tapRow(
            `lnurlw://example.com/withdraw?x=${query}`
        );

        expect(alertedMessage()).toBe(
            'utils.handleAnything.invalidLnurlParams'
        );
        expect(mockFetch).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('keeps the host policy message for a refused LNURL', async () => {
        const navigation = await tapRow('lnurlw://192.168.1.1/withdraw');

        expect(alertedMessage()).toBe('utils.lnurl.unsafeEndpoint');
        expect(mockFetch).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('opens ReceiveEcash for a valid withdraw LNURL', async () => {
        const params = {
            tag: 'withdrawRequest',
            callback: 'https://example.com/callback',
            k1: 'k1'
        };
        mockFetch.mockResolvedValue({
            info: () => ({ status: 200 }),
            json: () => params
        });

        const navigation = await tapRow('lnurlw://example.com/withdraw');

        expect(navigation.navigate).toHaveBeenCalledWith('ReceiveEcash', {
            lnurlParams: { ...params, domain: 'example.com' }
        });
        expect(alertSpy).not.toHaveBeenCalled();
    });
});

describe('EcashSwipeableRow LNURL requests', () => {
    const mountRow = async (lnurlParams?: any) => {
        const ref = React.createRef<any>();
        const navigation = { navigate: jest.fn() };
        await render(
            <EcashSwipeableRow
                {...({
                    ref,
                    lightning: asLnurl('https://example.com/lnurl'),
                    lnurlParams,
                    locked: true,
                    navigation,
                    SyncStore: { isSyncing: false }
                } as any)}
            >
                <Text>Withdraw</Text>
            </EcashSwipeableRow>
        );
        return { ref, navigation };
    };

    // A locked row with an LNURL starts the request when tapped
    const tapLnurl = async (lnurlParams?: any) => {
        const { navigation } = await mountRow(lnurlParams);
        await fireEvent.press(screen.getByText('Withdraw'));
        // the request is started but not awaited by the press handler
        await new Promise(setImmediate);
        return navigation;
    };

    let alertSpy: jest.SpyInstance;
    beforeEach(() => {
        mockFetchLnurlParams.mockReset();
        alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });
    afterEach(() => alertSpy.mockRestore());

    it('names the host the LNURL error came from', async () => {
        mockFetchLnurlParams.mockResolvedValue({
            status: 'ERROR',
            reason: 'Claim your refund',
            // js-lnurl's getDomain reads shop.example out of this URL
            domain: 'shop.example',
            url: 'https://other.example\\@shop.example/lnurl'
        });

        await tapLnurl();

        expect(alertSpy).toHaveBeenCalledWith(
            'general.error',
            'other.example says: Claim your refund',
            expect.any(Array),
            { cancelable: false }
        );
    });

    it('rejects an LNURL error from an onion host named by the request host', async () => {
        // Pressing the row alerts the rejection (see LNURL errors), so call
        // the handler directly to check which host it names
        const { ref, navigation } = await mountRow();

        await expect(
            ref.current.handleLnurlRequest(
                undefined,
                {
                    status: 'ERROR',
                    reason: 'Claim your refund',
                    domain: 'shop.example',
                    url: 'http://abc.onion\\@shop.example/lnurl'
                },
                navigation
            )
        ).rejects.toThrow('abc.onion says: Claim your refund');
        expect(alertSpy).not.toHaveBeenCalled();
    });

    // the resolve refuses these callbacks too; params handed to the row
    // already resolved are checked here
    it.each(['https:///a.example/cb', 'https://\\a.example/cb'])(
        'refuses a withdraw whose callback %s has no host',
        async (callback) => {
            const navigation = await tapLnurl({
                tag: 'withdrawRequest',
                callback,
                k1: 'k1'
            });

            expect(navigation.navigate).not.toHaveBeenCalled();
            expect(alertSpy).toHaveBeenCalledWith(
                'general.error',
                'utils.handleAnything.invalidLnurlParams'
            );
        }
    );
});
