import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    PermissionsAndroid,
    Platform,
    Alert,
    Modal
} from 'react-native';
import RNFS from 'react-native-fs';
import Button from '../../components/Button';
import TextInput from '../../components/TextInput';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import Invoice from '../../models/Invoice';
import Payment from '../../models/Payment';
import Transaction from '../../models/Transaction';

const JsonToCsv = ({ filteredActivity, isVisible, closeModal }) => {
    const [customFileName, setCustomFileName] = useState('');

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
                        case 'payment_addr':
                            filteredItem[key] = item.getDestination;
                            break;
                        case 'value':
                            filteredItem[key] = item.getAmount;
                            break;
                        case 'amount_msat':
                            filteredItem[key] = item.amount_msat;
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

    const convertJsonToCsv = async (data, type) => {
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
            { label: 'Payment Address', value: 'payment_addr' },
            { label: 'Value', value: 'value' },
            { label: 'Amount (msat)', value: 'amount_msat' },
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
            if (type === 'transaction') {
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

                return `Transaction Section\n${header}\n${rows}`;
            } else {
                const invoiceData = filteredData.filter(
                    (item) => item.amt_paid
                );
                const paymentData = filteredData.filter(
                    (item) => item.creation_date
                );

                const invoiceSection = [
                    'Invoice Section',
                    invoiceKeysToInclude.map((field) => field.label).join(','),
                    ...invoiceData.map((item) =>
                        invoiceKeysToInclude
                            .map((field) => item[field.value] || '')
                            .join(',')
                    )
                ].join('\n');

                const paymentSection = [
                    'Payment Section',
                    paymentKeysToInclude.map((field) => field.label).join(','),
                    ...paymentData.map((item) =>
                        paymentKeysToInclude
                            .map((field) => item[field.value] || '')
                            .join(',')
                    )
                ].join('\n');

                return `${invoiceSection}\n\n${paymentSection}`;
            }
        } catch (err) {
            console.error(err);
            return '';
        }
    };

    const requestAndroidPermissions = async () => {
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                {
                    title: 'Storage Permission Required',
                    message:
                        'This app needs access to your storage to save CSV files',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'OK'
                }
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            console.error('Failed to request permission ', err);
            return false;
        }
    };

    const downloadCsv = async () => {
        const invoicePaymentCsv = await convertJsonToCsv(
            filteredActivity.filter((item) => !(item instanceof Transaction)),
            'invoice_payment'
        );
        const transactionCsv = await convertJsonToCsv(
            filteredActivity.filter((item) => item instanceof Transaction),
            'transaction'
        );

        if (!invoicePaymentCsv && !transactionCsv) return;

        try {
            if (Platform.OS === 'android') {
                const hasPermission = await requestAndroidPermissions();
                if (!hasPermission) {
                    console.error('Storage permission denied');
                    return;
                }
            }

            const dateTime = getFormattedDateTime();
            const baseFileName = customFileName || `data_${dateTime}`;
            const invoicePaymentFileName = `${baseFileName}_invoice_payment.csv`;
            const transactionFileName = `${baseFileName}_transaction.csv`;

            const invoicePaymentFilePath =
                Platform.OS === 'android'
                    ? `${RNFS.DownloadDirectoryPath}/${invoicePaymentFileName}`
                    : `${RNFS.DocumentDirectoryPath}/${invoicePaymentFileName}`;

            const transactionFilePath =
                Platform.OS === 'android'
                    ? `${RNFS.DownloadDirectoryPath}/${transactionFileName}`
                    : `${RNFS.DocumentDirectoryPath}/${transactionFileName}`;

            if (invoicePaymentCsv) {
                await RNFS.writeFile(
                    invoicePaymentFilePath,
                    invoicePaymentCsv,
                    'utf8'
                );
            }

            if (transactionCsv) {
                await RNFS.writeFile(
                    transactionFilePath,
                    transactionCsv,
                    'utf8'
                );
            }

            Alert.alert(
                localeString('views.ActivityToCsv.csvDownloadSuccess'),
                localeString('views.ActivityToCsv.csvDownloaded')
            );
            closeModal();
        } catch (err) {
            console.error(
                localeString('views.ActivityToCsv.csvDownloadFailed'),
                err
            );
        }
    };

    return (
        <Modal
            visible={isVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={closeAndClearInput}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalView}>
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
                            title={localeString(
                                'views.ActivityToCsv.closeButton'
                            )}
                            onPress={closeAndClearInput}
                            secondary
                        />
                    </View>
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
    modalView: {
        width: '80%',
        backgroundColor: themeColor('background'),
        padding: 20,
        borderRadius: 10,
        alignItems: 'center',
        elevation: 5
    },
    buttonContainer: {
        width: '100%',
        marginTop: 20
    }
});

export default JsonToCsv;
