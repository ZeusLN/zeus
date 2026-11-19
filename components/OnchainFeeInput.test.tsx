jest.mock('../stores/Stores', () => ({
    feeStore: {
        getOnchainFeesviaMempool: jest.fn(),
        tempFee: undefined,
        setTempFee: jest.fn()
    },
    settingsStore: {
        settings: {
            privacy: { enableMempoolRates: true },
            payments: { preferredMempoolRate: 'fastestFee' }
        }
    }
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('./LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/TextInput', () => 'TextInput');

import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import OnchainFeeInput from './OnchainFeeInput';
import { feeStore, settingsStore } from '../stores/Stores';

const mockedGetOnchainFeesviaMempool =
    feeStore.getOnchainFeesviaMempool as jest.Mock;
const mutableSettings = settingsStore as any;

const navigation = {
    addListener: jest.fn(() => jest.fn()),
    navigate: jest.fn()
};

const renderInput = async (props: Record<string, any> = {}) => {
    const onChangeFee = jest.fn();
    const onFeeError = jest.fn();
    await act(async () => {
        render(
            <OnchainFeeInput
                navigation={navigation as any}
                onChangeFee={onChangeFee}
                onFeeError={onFeeError}
                {...props}
            />
        );
    });
    return { onChangeFee, onFeeError };
};

beforeEach(() => {
    jest.clearAllMocks();
    mutableSettings.settings = {
        privacy: { enableMempoolRates: true },
        payments: { preferredMempoolRate: 'fastestFee' }
    };
    (feeStore as any).tempFee = undefined; // Reset tempFee
    navigation.addListener.mockImplementation(() => jest.fn());
});

describe('OnchainFeeInput fee fetching', () => {
    it('treats a resolved undefined as a failure', async () => {
        mockedGetOnchainFeesviaMempool.mockResolvedValue(undefined);
        const { onChangeFee, onFeeError } = await renderInput();

        expect(onFeeError).toHaveBeenCalledWith(true);
        expect(onChangeFee).toHaveBeenCalledWith('0');
        expect(screen.getByText('views.EditFee.error')).toBeOnTheScreen();
    });

    it('treats an empty response object as a failure', async () => {
        mockedGetOnchainFeesviaMempool.mockResolvedValue({});
        const { onChangeFee, onFeeError } = await renderInput();

        expect(onFeeError).toHaveBeenCalledWith(true);
        expect(onChangeFee).toHaveBeenCalledWith('0');
        expect(screen.getByText('views.EditFee.error')).toBeOnTheScreen();
    });

    it('treats a rejected fetch the same as a resolved undefined', async () => {
        mockedGetOnchainFeesviaMempool.mockRejectedValue(new Error('offline'));
        const { onChangeFee, onFeeError } = await renderInput();

        expect(onFeeError).toHaveBeenCalledWith(true);
        expect(onChangeFee).toHaveBeenCalledWith('0');
        expect(screen.getByText('views.EditFee.error')).toBeOnTheScreen();
    });

    it('uses the preferred mempool rate', async () => {
        mutableSettings.settings.payments.preferredMempoolRate = 'halfHourFee';
        mockedGetOnchainFeesviaMempool.mockResolvedValue({
            halfHourFee: 15,
            fastestFee: 20
        });
        const { onChangeFee, onFeeError } = await renderInput();

        expect(onChangeFee).toHaveBeenCalledWith('15');
        expect(onFeeError).not.toHaveBeenCalled();
        expect(screen.getByText('15')).toBeOnTheScreen();
    });

    it('falls back to fastestFee when the preferred rate is missing', async () => {
        mockedGetOnchainFeesviaMempool.mockResolvedValue({ fastestFee: 20 });
        const { onChangeFee, onFeeError } = await renderInput();

        expect(onChangeFee).toHaveBeenCalledWith('20');
        expect(onFeeError).not.toHaveBeenCalled();
        expect(screen.getByText('20')).toBeOnTheScreen();
    });

    it('does not fetch when a valid fee is passed in', async () => {
        const { onChangeFee } = await renderInput({ fee: '5' });

        expect(mockedGetOnchainFeesviaMempool).not.toHaveBeenCalled();
        expect(onChangeFee).toHaveBeenCalledWith('5');
    });

    it('clears the error when a rate comes back from EditFee', async () => {
        mockedGetOnchainFeesviaMempool.mockResolvedValue(undefined);
        const { onChangeFee } = await renderInput();

        expect(screen.getByText('views.EditFee.error')).toBeOnTheScreen();
        const focus = (navigation.addListener.mock.calls as any[]).find(
            (c) => c[0] === 'focus'
        )[1];
        (feeStore as any).tempFee = '7';
        await act(async () => focus());

        expect(onChangeFee).toHaveBeenLastCalledWith('7');
        expect(feeStore.setTempFee).toHaveBeenCalledWith('');
        expect(screen.queryByText('views.EditFee.error')).toBeNull();
    });

    it('fetches when the fee passed in is 0', async () => {
        mockedGetOnchainFeesviaMempool.mockResolvedValue({ fastestFee: 9 });
        const { onChangeFee } = await renderInput({ fee: '0' });

        expect(mockedGetOnchainFeesviaMempool).toHaveBeenCalledTimes(1);
        expect(onChangeFee).toHaveBeenCalledWith('9');
    });

    it('does not fetch with mempool rates off', async () => {
        mutableSettings.settings.privacy.enableMempoolRates = false;
        await renderInput();

        expect(mockedGetOnchainFeesviaMempool).not.toHaveBeenCalled();
    });
});
