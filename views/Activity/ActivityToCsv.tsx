import React, { useState } from 'react';
import { StyleSheet, View, Modal } from 'react-native';

import Invoice from '../../models/Invoice';
import Payment from '../../models/Payment';
import Transaction from '../../models/Transaction';
import CashuInvoice from '../../models/CashuInvoice';
import CashuPayment from '../../models/CashuPayment';
import Swap from '../../models/Swap';
import { LSPActivity } from '../../models/LSP';

import Button from '../../components/Button';
import TextInput from '../../components/TextInput';
import LoadingIndicator from '../../components/LoadingIndicator';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import {
    getFormattedDateTime,
    convertActivityToCsv,
    shareCsvFiles,
    CSV_KEYS
} from '../../utils/ActivityCsvUtils';

type ActivityItem = Invoice | Payment | Transaction | Swap | LSPActivity;

interface ActivityProps {
    filteredActivity: Array<ActivityItem>;
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

    const downloadCsv = async () => {
        setIsLoading(true);
        setTimeout(async () => {
            const invoiceCsv = await convertActivityToCsv(
                filteredActivity.filter(
                    (item: any) =>
                        item instanceof Invoice || item instanceof CashuInvoice
                ),
                CSV_KEYS.invoice
            );
            const paymentCsv = await convertActivityToCsv(
                filteredActivity.filter(
                    (item: any) =>
                        item instanceof Payment || item instanceof CashuPayment
                ),
                CSV_KEYS.payment
            );
            const transactionCsv = await convertActivityToCsv(
                filteredActivity.filter(
                    (item: any) => item instanceof Transaction
                ),
                CSV_KEYS.transaction
            );

            if (!invoiceCsv && !paymentCsv && !transactionCsv) {
                setIsLoading(false);
                return;
            }

            try {
                const dateTime = getFormattedDateTime();
                const baseFileName = customFileName || `zeus_${dateTime}`;
                const files = [];
                if (invoiceCsv)
                    files.push({
                        fileName: `${baseFileName}_ln_invoices.csv`,
                        csvData: invoiceCsv
                    });
                if (paymentCsv)
                    files.push({
                        fileName: `${baseFileName}_ln_payments.csv`,
                        csvData: paymentCsv
                    });
                if (transactionCsv)
                    files.push({
                        fileName: `${baseFileName}_onchain.csv`,
                        csvData: transactionCsv
                    });

                await shareCsvFiles(files);

                closeModal();
            } catch (err) {
                console.error('Failed to share CSV file:', err);
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
