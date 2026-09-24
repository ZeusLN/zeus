jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('react-native-blob-util', () => ({}));
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
const tapRow = async (lightning: string) => {
    const navigation = { navigate: jest.fn() };
    await render(
        <EcashSwipeableRow
            {...({
                lightning,
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
