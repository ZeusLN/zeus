jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ ButtonGroup: 'ButtonGroup' }));
jest.mock('../../stores/CashuStore', () => ({}));
jest.mock('../../stores/ChannelsStore', () => ({}));
jest.mock('../../stores/ModalStore', () => ({}));
// UrlUtils, which decides what counts as cleartext, imports SettingsStore
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/Stores', () => ({
    activityStore: {},
    settingsStore: { settings: { ecash: { enableCashu: true } } }
}));
jest.mock('../../utils/ActionUtils', () => ({
    confirmAction: jest.fn()
}));
jest.mock('../../utils/AddressUtils', () => ({ ZEUS_ECASH_GIFT_URL: '' }));
jest.mock('../../utils/BackendUtils', () => ({
    supportsCashuWallet: () => true,
    supportsChannelManagement: () => true
}));
jest.mock('../../utils/buttonGroupStyles', () => ({
    getButtonGroupStyles: () => ({})
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../components/Amount', () => {
    const { Text } = require('react-native');
    return ({ sats }: any) => <Text testID="amount">{String(sats)}</Text>;
});
jest.mock('../../components/AnimatedQRDisplay', () => 'AnimatedQRDisplay');
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            disabled={disabled}
        >
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/SuccessErrorMessage', () => ({
    SuccessMessage: 'SuccessMessage',
    WarningMessage: 'WarningMessage',
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return Text;
});

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import CashuTokenView from './CashuToken';
import { confirmAction } from '../../utils/ActionUtils';

const ADD_MINT = 'views.Cashu.AddMint.title';
const SELF_CUSTODY = 'views.Cashu.CashuToken.meltTokenSelfCustody';

const renderToken = async (
    mint: string,
    mintUrls: string[] = [],
    claimResult: Record<string, unknown> = { success: true }
) => {
    const CashuStore = {
        mintUrls,
        cashuWallets: {},
        loading: false,
        errorAddingMint: false,
        clearToken: jest.fn(),
        initializeWallet: jest.fn(),
        checkTokenSpent: jest.fn().mockResolvedValue(false),
        markTokenSpent: jest.fn(),
        setLoading: jest.fn(),
        addMint: jest.fn().mockResolvedValue(undefined),
        claimToken: jest.fn().mockResolvedValue(claimResult)
    };
    await render(
        <CashuTokenView
            {...({
                navigation: {},
                route: {
                    params: {
                        decoded: {
                            mint,
                            unit: 'sat',
                            proofs: [],
                            getAmount: 21,
                            isSupported: true,
                            encodedToken: 'cashuBtoken'
                        }
                    }
                },
                CashuStore,
                ChannelsStore: { channels: [{}] }
            } as any)}
        />
    );
    return CashuStore;
};

// Answers the warning dialog with its proceed or cancel button
const answerWarning = (button: 'proceed' | 'cancel') =>
    (confirmAction as jest.Mock).mockImplementation(
        (_title, _message, proceed, cancel) =>
            (button === 'proceed' ? proceed : cancel).onPress()
    );

describe('CashuToken cleartext http:// mint', () => {
    beforeEach(() => {
        (confirmAction as jest.Mock).mockReset();
    });

    describe.each([
        [ADD_MINT, 'addMint'],
        [SELF_CUSTODY, 'claimToken']
    ] as const)('%s', (title, action) => {
        it('warns before contacting the mint', async () => {
            answerWarning('cancel');
            await renderToken('http://mint.example.com');

            await fireEvent.press(screen.getByText(title));

            expect(confirmAction).toHaveBeenCalledTimes(1);
            expect((confirmAction as jest.Mock).mock.calls[0][1]).toBe(
                'views.Cashu.AddMint.cleartextHttpWarning'
            );
        });

        it('goes ahead when the warning is accepted', async () => {
            answerWarning('proceed');
            const store = await renderToken('http://mint.example.com');

            await fireEvent.press(screen.getByText(title));

            expect(store[action]).toHaveBeenCalledTimes(1);
        });

        it('does nothing when the warning is declined', async () => {
            answerWarning('cancel');
            const store = await renderToken('http://mint.example.com');

            await fireEvent.press(screen.getByText(title));

            expect(store[action]).not.toHaveBeenCalled();
        });

        it.each([
            'https://mint.example.com',
            'http://abcdefghijklmnop.onion',
            'http://127.0.0.1:3338'
        ])('does not warn on %s', async (mint) => {
            const store = await renderToken(mint);

            await fireEvent.press(screen.getByText(title));

            expect(confirmAction).not.toHaveBeenCalled();
            expect(store[action]).toHaveBeenCalledTimes(1);
        });
    });

    it('does not warn on self-custody receive from a mint in the wallet', async () => {
        const mint = 'http://mint.example.com';
        const store = await renderToken(mint, [mint]);

        await fireEvent.press(screen.getByText(SELF_CUSTODY));

        expect(confirmAction).not.toHaveBeenCalled();
        expect(store.claimToken).toHaveBeenCalledTimes(1);
    });
});

// The token is worth 21 sats. A self-custody claim swept to the node
// receives less, after the mint's fee.
describe('CashuToken amount shown', () => {
    const MINT = 'https://mint.example.com';
    const shownSats = () => screen.getByTestId('amount').props.children;

    const claim = async (claimResult: Record<string, unknown>) => {
        await renderToken(MINT, [MINT], claimResult);
        await fireEvent.press(screen.getByText(SELF_CUSTODY));
    };

    it('is the token amount before the claim', async () => {
        await renderToken(MINT, [MINT]);

        expect(shownSats()).toBe('21');
    });

    it('is what the node received after a swept claim', async () => {
        await claim({ success: true, receivedAmtSat: 18 });

        expect(shownSats()).toBe('18');
    });

    it('stays the token amount when the token was claimed but not swept', async () => {
        await claim({
            success: true,
            warningMessage: 'stores.CashuStore.claimedButNotSwept'
        });

        expect(shownSats()).toBe('21');
    });

    it('stays the token amount when the claim fails', async () => {
        await claim({
            success: false,
            errorMessage: 'stores.CashuStore.sweepFeeTooHigh',
            receivedAmtSat: 18
        });

        expect(shownSats()).toBe('21');
    });
});
