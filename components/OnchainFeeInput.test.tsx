const mockSettingsStore: any = { settings: {} };
const mockFeeStore: any = {
    getOnchainFeesviaMempool: jest.fn(),
    tempFee: '',
    setTempFee: jest.fn()
};

// getters, because this factory runs before the consts above are set
jest.mock('../stores/Stores', () => ({
    get feeStore() {
        return mockFeeStore;
    },
    get settingsStore() {
        return mockSettingsStore;
    }
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('./LoadingIndicator', () => 'LoadingIndicator');
jest.mock('./TextInput', () => 'TextInput');

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import OnchainFeeInput from './OnchainFeeInput';

const navigation: any = {
    navigate: jest.fn(),
    addListener: jest.fn(() => jest.fn())
};

const renderInput = async (props: any = {}) => {
    const onChangeFee = jest.fn();
    await render(
        <OnchainFeeInput
            navigation={navigation}
            onChangeFee={onChangeFee}
            {...props}
        />
    );
    return { onChangeFee };
};

const textInput = () =>
    screen.container.queryAll((n) => n.type === 'TextInput')[0];

beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsStore.settings = {};
});

describe('OnchainFeeInput manual entry', () => {
    it.each([
        ['', true],
        ['0', true],
        ['0.5', true],
        ['1', false],
        ['2000', false],
        ['2001', true]
    ])('flags %p as %p on a whole sat/vB backend', async (fee, error) => {
        await renderInput({ fee });
        expect(textInput().props.error).toBe(error);
        expect(textInput().props.placeholder).toBe('10');
    });

    it.each([
        ['', false],
        ['0', false],
        ['0.05', true],
        ['0.1', false],
        ['0.5', false],
        ['2001', true]
    ])(
        'flags %p as %p on a backend with auto and sub-sat rates',
        async (fee, error) => {
            await renderInput({ fee, autoFeeRate: true, subSatFeeRate: true });
            expect(textInput().props.error).toBe(error);
            expect(textInput().props.placeholder).toBe('general.automatic');
        }
    );

    it('reports what the user types', async () => {
        const { onChangeFee } = await renderInput({ fee: '' });
        await fireEvent.changeText(textInput(), '0.5');
        expect(onChangeFee).toHaveBeenCalledWith('0.5');
    });
});

describe('OnchainFeeInput with mempool rates', () => {
    beforeEach(() => {
        mockSettingsStore.settings = { privacy: { enableMempoolRates: true } };
    });

    it.each([true, false, undefined])(
        'passes subSatFeeRate=%p on to EditFee',
        async (subSatFeeRate) => {
            await renderInput({ fee: '5', subSatFeeRate });
            await fireEvent.press(screen.getByText('5'));
            expect(navigation.navigate).toHaveBeenCalledWith('EditFee', {
                fee: '5',
                subSatFeeRate
            });
        }
    );
});
