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
import { Parser } from '@json2csv/plainjs';
import Button from '../../components/Button';
import TextInput from '../../components/TextInput';
import dateTimeUtils from '../../utils/DateTimeUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import Invoice from '../../models/Invoice';

const JsonToCsv = ({ filteredActivity, isVisible, closeModal }) => {
    const [customFileName, setCustomFileName] = useState('');

    const closeAndClearInput = () => {
        setCustomFileName('');
        closeModal();
    };

    const getFormattedDateTime = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Months are zero-based
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');

        return `${year}${month}${day}_${hours}${minutes}${seconds}`;
    };

    const filterData = (data, keys) => {
        return data.map((item) => {
            let filteredItem = {};
            keys.forEach((key) => {
                if (item instanceof Invoice) {
                    switch (key) {
                        case 'amt_paid':
                            filteredItem[key] = item.getAmount;
                            break;
                        case 'amt_paid_sat':
                            filteredItem[key] = item.getAmount;
                            break;
                        case 'cltv_expiry':
                            filteredItem[key] = item.originalTimeUntilExpiryInSeconds;
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
                } else {
                    if (key === 'creation_date') {
                        filteredItem[key] = dateTimeUtils.listFormattedDate(item[key]);
                    } else {
                        filteredItem[key] = item[key];
                    }
                }
            });
            return filteredItem;
        });
    };

    const convertJsonToCsv = async (data) => {
        if (!data || data.length === 0) {
            return '';
        }

        const keysToInclude = [
            'amt_paid',
            'amt_paid_sat',
            'cltv_expiry',
            'creation_date',
            'expiry'
        ];

        const filteredData = filterData(data, keysToInclude);

        try {
            const parser = new Parser();
            const csv = parser.parse(filteredData);
            return csv;
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
                    message: 'This app needs access to your storage to save CSV files',
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
        const csv = await convertJsonToCsv(filteredActivity);
        if (!csv) return;

        try {
            if (Platform.OS === 'android') {
                const hasPermission = await requestAndroidPermissions();
                if (!hasPermission) {
                    console.error('Storage permission denied');
                    return;
                }
            }

            const dateTime = getFormattedDateTime();
            const fileName = customFileName
                ? `${customFileName}.csv`
                : `data_${dateTime}.csv`;
            const filePath =
                Platform.OS === 'android'
                    ? `${RNFS.DownloadDirectoryPath}/${fileName}`
                    : `${RNFS.DocumentDirectoryPath}/${fileName}`;

            await RNFS.writeFile(filePath, csv, 'utf8');
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
        alignItems: 'center'
    },
    buttonContainer: {
        width: '100%',
        alignItems: 'center'
    }
});

export default JsonToCsv;
