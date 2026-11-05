// The real models pull in the stores graph and its native modules; the
// view only needs them for instanceof checks
jest.mock('../../models/Invoice', () => class Invoice {});
jest.mock('../../models/Payment', () => class Payment {});
jest.mock('../../models/Transaction', () => class Transaction {});
jest.mock('../../models/CashuInvoice', () => class CashuInvoice {});
jest.mock('../../models/CashuPayment', () => class CashuPayment {});
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../utils/ActivityCsvUtils', () => ({
    getFormattedDateTime: () => '20261105_120000',
    convertActivityToCsv: jest.fn(),
    shareCsvFiles: jest.fn(),
    CSV_KEYS: { invoice: [], payment: [], transaction: [] }
}));
jest.mock('../../components/Button', () => {
    const { Text } = require('react-native');
    return ({ title, onPress }: any) => <Text onPress={onPress}>{title}</Text>;
});
jest.mock('../../components/TextInput', () => 'TextInput');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');

import * as React from 'react';
import { Alert } from 'react-native';
import {
    fireEvent,
    render,
    screen,
    waitFor
} from '@testing-library/react-native';
import {
    convertActivityToCsv,
    shareCsvFiles
} from '../../utils/ActivityCsvUtils';
import ActivityToCsv from './ActivityToCsv';

const mockConvert = convertActivityToCsv as jest.Mock;
const mockShare = shareCsvFiles as jest.Mock;

const renderModal = async (closeModal = jest.fn()) => {
    await render(
        <ActivityToCsv
            filteredActivity={[]}
            isVisible
            closeModal={closeModal}
        />
    );
    return closeModal;
};

describe('ActivityToCsv', () => {
    let alertSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        mockConvert.mockResolvedValue('csv');
        alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        alertSpy.mockRestore();
    });

    it('shares the CSVs and closes without an alert', async () => {
        const closeModal = await renderModal();
        mockShare.mockResolvedValue(undefined);

        await fireEvent.press(
            screen.getByText('views.ActivityToCsv.downloadButton')
        );

        await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
        expect(mockShare).toHaveBeenCalledWith([
            {
                fileName: 'zeus_20261105_120000_ln_invoices.csv',
                csvData: 'csv'
            },
            {
                fileName: 'zeus_20261105_120000_ln_payments.csv',
                csvData: 'csv'
            },
            {
                fileName: 'zeus_20261105_120000_onchain.csv',
                csvData: 'csv'
            }
        ]);
        expect(alertSpy).not.toHaveBeenCalled();
    });

    it('shows an error and stays open when the share fails', async () => {
        const consoleErrorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const closeModal = await renderModal();
        mockShare.mockRejectedValue(new Error('share failed'));

        await fireEvent.press(
            screen.getByText('views.ActivityToCsv.downloadButton')
        );

        await waitFor(() =>
            expect(alertSpy).toHaveBeenCalledWith(
                'general.error',
                'views.ActivityToCsv.csvDownloadFailed'
            )
        );
        expect(closeModal).not.toHaveBeenCalled();
        // the spinner is gone, so the user can retry
        expect(
            screen.getByText('views.ActivityToCsv.downloadButton')
        ).toBeTruthy();
        consoleErrorSpy.mockRestore();
    });

    it('does nothing when there is no data to export', async () => {
        const closeModal = await renderModal();
        mockConvert.mockResolvedValue('');

        await fireEvent.press(
            screen.getByText('views.ActivityToCsv.downloadButton')
        );

        await waitFor(() => expect(mockConvert).toHaveBeenCalledTimes(3));
        await waitFor(() =>
            expect(
                screen.getByText('views.ActivityToCsv.downloadButton')
            ).toBeTruthy()
        );
        expect(mockShare).not.toHaveBeenCalled();
        expect(alertSpy).not.toHaveBeenCalled();
        expect(closeModal).not.toHaveBeenCalled();
    });
});
