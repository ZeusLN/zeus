jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('js-lnurl', () => ({ getParams: jest.fn() }));
jest.mock('../../utils/BackendUtils', () => ({}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#ffffff' }));
jest.mock('../../stores/Stores', () => ({ cashuStore: {} }));
jest.mock('../../stores/SyncStore', () => ({}));
jest.mock('./SwipeableRowAction', () => 'SwipeableRowAction');
jest.mock('./SwipeableRowContainer', () => 'SwipeableRowContainer');

import * as React from 'react';
import { Alert, Text } from 'react-native';
import { getParams as getlnurlParams } from 'js-lnurl';
import { fireEvent, render, screen } from '@testing-library/react-native';
import EcashSwipeableRow from './EcashSwipeableRow';

describe('EcashSwipeableRow LNURL requests', () => {
    const mountRow = async () => {
        const ref = React.createRef<any>();
        const navigation = { navigate: jest.fn() };
        await render(
            <EcashSwipeableRow
                {...({
                    ref,
                    lightning: 'lnurl1example',
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
    const tapLnurl = async (params: any) => {
        (getlnurlParams as jest.Mock).mockResolvedValue(params);
        const { navigation } = await mountRow();
        await fireEvent.press(screen.getByText('Withdraw'));
        // the request is started but not awaited by the press handler
        await new Promise(setImmediate);
        return navigation;
    };

    let alertSpy: jest.SpyInstance;
    beforeEach(() => {
        alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });
    afterEach(() => alertSpy.mockRestore());

    it('names the host the LNURL error came from', async () => {
        await tapLnurl({
            status: 'ERROR',
            reason: 'Claim your refund',
            // js-lnurl's getDomain reads shop.example out of this URL
            domain: 'shop.example',
            url: 'https://other.example\\@shop.example/lnurl'
        });

        expect(alertSpy).toHaveBeenCalledWith(
            'general.error',
            'other.example says: Claim your refund',
            expect.any(Array),
            { cancelable: false }
        );
    });

    it('rejects an LNURL error from an onion host named by the request host', async () => {
        // Pressing the row would leave this rejection unhandled, so call the
        // handler directly
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

    it('opens ReceiveEcash for a withdraw with a callback host', async () => {
        const params = {
            tag: 'withdrawRequest',
            callback: 'https://faucet.example/withdraw',
            k1: 'k1'
        };

        const navigation = await tapLnurl(params);

        expect(navigation.navigate).toHaveBeenCalledWith('ReceiveEcash', {
            lnurlParams: params
        });
    });

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
