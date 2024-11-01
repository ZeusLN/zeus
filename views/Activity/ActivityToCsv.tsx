import React, { useState } from 'react';
import { StyleSheet, View, Platform, Alert, Modal } from 'react-native';
import RNFS from 'react-native-fs';
import Button from '../../components/Button';
import TextInput from '../../components/TextInput';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import Invoice from '../../models/Invoice';
import Payment from '../../models/Payment';
import Transaction from '../../models/Transaction';
import LoadingIndicator from '../../components/LoadingIndicator';

interface ActivityProps {
    filteredActivity: Array<Invoice | Payment | Transaction>;
    isVisible: boolean;
    closeModal: () => void;
}

const ActivityToCsv: React.FC<ActivityProps> = ({
    filteredActivity,
    isVisible,
    closeModal
}) => {
    const [customFileName, setCustomFileName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const closeAndClearInput = () => {
        setCustomFileName('');
        closeModal();
    };

    const getFormattedDateTime = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');

        return `${year}${month}${day}_${hours}${minutes}${seconds}`;
    };

    const convertActivityToCsv = async (
        data: Array<Invoice | Payment | Transaction>,
        keysToInclude: Array<any>
    ) => {
        if (!data || data.length === 0) {
            return '';
        }

        try {
            const header = keysToInclude.map((field) => field.label).join(',');
            const rows = data
                ?.map((item: any) =>
                    keysToInclude
                        .map((field) => `"${item[field.value]}"` || '')
                        .join(',')
                )
                .join('\n');

            return `${header}\n${rows}`;
        } catch (err) {
            console.error(err);
            return '';
        }
    };

    const downloadCsv = async () => {
        setIsLoading(true);
        setTimeout(async () => {
            const invoiceKeys = [
                { label: 'Amount Paid (sat)', value: 'getAmount' },
                { label: 'Payment Request', value: 'getPaymentRequest' },
                { label: 'Payment Hash', value: 'getRHash' },
                { label: 'Memo', value: 'getMemo' },
                { label: 'Note', value: 'getNote' },
                { label: 'Creation Date', value: 'getCreationDate' },
                { label: 'Expiry', value: 'formattedTimeUntilExpiry' }
            ];

            const paymentKeys = [
                { label: 'Destination', value: 'getDestination' },
                { label: 'Payment Request', value: 'getPaymentRequest' },
                { label: 'Payment Hash', value: 'paymentHash' },
                { label: 'Amount Paid (sat)', value: 'getAmount' },
                { label: 'Memo', value: 'getMemo' },
                { label: 'Note', value: 'getNote' },
                { label: 'Creation Date', value: 'getDate' }
            ];

            const transactionKeys = [
                { label: 'Transaction Hash', value: 'tx' },
                { label: 'Amount (sat)', value: 'getAmount' },
                { label: 'Total Fees (sat)', value: 'getFee' },
                { label: 'Note', value: 'getNote' },
                { label: 'Timestamp', value: 'getDate' }
            ];

            const invoiceCsv = await convertActivityToCsv(
                filteredActivity.filter((item: any) => item instanceof Invoice),
                invoiceKeys
            );
            const paymentCsv = await convertActivityToCsv(
                filteredActivity.filter((item: any) => item instanceof Payment),
                paymentKeys
            );
            const transactionCsv = await convertActivityToCsv(
                filteredActivity.filter(
                    (item: any) => item instanceof Transaction
                ),
                transactionKeys
            );

            if (!invoiceCsv && !paymentCsv && !transactionCsv) {
                setIsLoading(false);
                return;
            }

            try {
                const dateTime = getFormattedDateTime();
                const baseFileName = customFileName || `zeus_${dateTime}`;
                const invoiceFileName = `${baseFileName}_ln_invoices.csv`;
                const paymentFileName = `${baseFileName}_ln_payments.csv`;
                const transactionFileName = `${baseFileName}_onchain.csv`;

                const invoiceFilePath =
                    Platform.OS === 'android'
                        ? `${RNFS.DownloadDirectoryPath}/${invoiceFileName}`
                        : `${RNFS.DocumentDirectoryPath}/${invoiceFileName}`;

                const paymentFilePath =
                    Platform.OS === 'android'
                        ? `${RNFS.DownloadDirectoryPath}/${paymentFileName}`
                        : `${RNFS.DocumentDirectoryPath}/${paymentFileName}`;

                const transactionFilePath =
                    Platform.OS === 'android'
                        ? `${RNFS.DownloadDirectoryPath}/${transactionFileName}`
                        : `${RNFS.DocumentDirectoryPath}/${transactionFileName}`;

                if (invoiceCsv) {
                    console.log('invoiceFilePath', invoiceFilePath);
                    await RNFS.writeFile(invoiceFilePath, invoiceCsv, 'utf8');
                }

                if (paymentCsv) {
                    console.log('paymentFilePath', paymentFilePath);
                    await RNFS.writeFile(paymentFilePath, paymentCsv, 'utf8');
                }

                if (transactionCsv) {
                    console.log('transactionFilePath', transactionFilePath);
                    await RNFS.writeFile(
                        transactionFilePath,
                        transactionCsv,
                        'utf8'
                    );
                }

                Alert.alert(
                    localeString('general.success'),
                    localeString('views.ActivityToCsv.csvDownloaded')
                );
                closeModal();
            } catch (err) {
                console.error('Failed to save CSV file:', err);
            } finally {
                setIsLoading(false);
            }
        }, 0);
    };

    return (
        <Modal
            visible={isVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={closeAndClearInput}
        >
            <View style={styles.modalOverlay}>
                <View
                    style={{
                        width: '80%',
                        backgroundColor: themeColor('background'),
                        padding: 20,
                        borderRadius: 10,
                        alignItems: 'center',
                        elevation: 5
                    }}
                >
                    {isLoading ? (
                        <LoadingIndicator />
                    ) : (
                        <>
                            <TextInput
                                placeholder={localeString(
                                    'views.ActivityToCsv.textInputPlaceholder'
                                )}
                                value={customFileName}
                                onChangeText={setCustomFileName}
                            />
                            <View style={styles.buttonContainer}>
                                <Button
                                    title={localeString(
                                        'views.ActivityToCsv.downloadButton'
                                    )}
                                    onPress={downloadCsv}
                                    buttonStyle={{
                                        marginBottom: 10
                                    }}
                                />
                                <Button
                                    title={localeString('general.close')}
                                    onPress={closeAndClearInput}
                                    secondary
                                />
                            </View>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    buttonContainer: {
        width: '100%',
        marginTop: 20
    }
});

export default ActivityToCsv;
