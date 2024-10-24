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

const ActivityToCsv = ({ filteredActivity, isVisible, closeModal }) => {
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

    const filterData = (data, invoiceKeys, paymentKeys, transactionKeys) => {
        return data.map((item) => {
            let filteredItem = {};
            if (item instanceof Invoice) {
                invoiceKeys.forEach((key) => {
                    switch (key) {
                        case 'amt_paid':
                        case 'amt_paid_sat':
                            filteredItem[key] = item.getAmount;
                            break;
                        case 'cltv_expiry':
                            filteredItem[key] =
                                item.originalTimeUntilExpiryInSeconds;
                            break;
                        case 'creation_date':
                            filteredItem[key] = item.formattedCreationDate;
                            break;
                        case 'expiry':
                            filteredItem[key] = item.formattedTimeUntilExpiry;
                            break;
                        default:
                            filteredItem[key] = item[key];
                    }
                });
            } else if (item instanceof Payment) {
                paymentKeys.forEach((key) => {
                    switch (key) {
                        case 'payment_hash':
                            filteredItem[key] = item.paymentHash;
                            break;
                        case 'payment_addr':
                            filteredItem[key] = item.getDestination;
                            break;
                        case 'value':
                        case 'amount_msat':
                            filteredItem[key] = item.getAmount;
                            break;
                        case 'creation_date':
                            filteredItem[key] = item.getDisplayTime;
                            break;
                        default:
                            filteredItem[key] = item[key];
                    }
                });
            } else if (item instanceof Transaction) {
                transactionKeys.forEach((key) => {
                    switch (key) {
                        case 'tx_hash':
                            filteredItem[key] = item.tx;
                            break;
                        case 'value':
                            filteredItem[key] = item.getAmount;
                            break;
                        case 'total_fees':
                            filteredItem[key] = item.getFee;
                            break;
                        case 'time_stamp':
                            filteredItem[key] = item.getDisplayTime;
                            break;
                        default:
                            filteredItem[key] = item[key];
                    }
                });
            }
            return filteredItem;
        });
    };

    const convertActivityToCsv = async (data, type) => {
        if (!data || data.length === 0) {
            return '';
        }

        const invoiceKeysToInclude = [
            { label: 'Amount Paid', value: 'amt_paid' },
            { label: 'Amount Paid (Sat)', value: 'amt_paid_sat' },
            { label: 'CLTV Expiry', value: 'cltv_expiry' },
            { label: 'Creation Date', value: 'creation_date' },
            { label: 'Expiry', value: 'expiry' }
        ];

        const paymentKeysToInclude = [
            { label: 'Destination', value: 'payment_addr' },
            { label: 'Payment Hash', value: 'payment_hash' },
            { label: 'Value', value: 'value' },
            { label: 'Creation Date', value: 'creation_date' }
        ];

        const transactionKeysToInclude = [
            { label: 'Transaction Hash', value: 'tx_hash' },
            { label: 'Amount', value: 'amount' },
            { label: 'Total Fees', value: 'total_fees' },
            { label: 'Timestamp', value: 'time_stamp' }
        ];

        const filteredData = filterData(
            data,
            invoiceKeysToInclude.map((key) => key.value),
            paymentKeysToInclude.map((key) => key.value),
            transactionKeysToInclude.map((key) => key.value)
        );

        try {
            if (type === 'invoice') {
                const invoiceData = filteredData.filter(
                    (item) => item.amt_paid
                );

                const header = invoiceKeysToInclude
                    .map((field) => field.label)
                    .join(',');
                const rows = invoiceData
                    .map((item) =>
                        invoiceKeysToInclude
                            .map((field) => item[field.value] || '')
                            .join(',')
                    )
                    .join('\n');

                return `${localeString(
                    'pos.print.invoice'
                )}\n${header}\n${rows}`;
            } else if (type === 'payment') {
                const paymentData = filteredData.filter(
                    (item) => item.payment_addr
                );

                const header = paymentKeysToInclude
                    .map((field) => field.label)
                    .join(',');
                const rows = paymentData
                    .map((item) =>
                        paymentKeysToInclude
                            .map((field) => item[field.value] || '')
                            .join(',')
                    )
                    .join('\n');

                return `${localeString(
                    'views.Wallet.Wallet.payments'
                )}\n${header}\n${rows}`;
            } else if (type === 'transaction') {
                const transactionData = filteredData.filter(
                    (item) => item.tx_hash
                );

                const header = transactionKeysToInclude
                    .map((field) => field.label)
                    .join(',');
                const rows = transactionData
                    .map((item) =>
                        transactionKeysToInclude
                            .map((field) => item[field.value] || '')
                            .join(',')
                    )
                    .join('\n');

                return `${localeString(
                    'general.transaction'
                )}\n${header}\n${rows}`;
            }
        } catch (err) {
            console.error(err);
            return '';
        }
    };

    const downloadCsv = async () => {
        setIsLoading(true);
        setTimeout(async () => {
            const invoiceCsv = await convertActivityToCsv(
                filteredActivity.filter((item) => item instanceof Invoice),
                'invoice'
            );
            const paymentCsv = await convertActivityToCsv(
                filteredActivity.filter((item) => item instanceof Payment),
                'payment'
            );
            const transactionCsv = await convertActivityToCsv(
                filteredActivity.filter((item) => item instanceof Transaction),
                'transaction'
            );

            if (!invoiceCsv && !paymentCsv && !transactionCsv) {
                setIsLoading(false);
                return;
            }

            try {
                const dateTime = getFormattedDateTime();
                const baseFileName = customFileName || `data_${dateTime}`;
                const invoiceFileName = `${baseFileName}_invoice.csv`;
                const paymentFileName = `${baseFileName}_payment.csv`;
                const transactionFileName = `${baseFileName}_transaction.csv`;

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
                console.error(
                    localeString('views.ActivityToCsv.csvDownloadFailed'),
                    err
                );
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
