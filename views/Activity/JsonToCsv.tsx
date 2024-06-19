import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    PermissionsAndroid,
    Platform,
    Alert,
    Modal,
    TextInput,
    TouchableOpacity
} from 'react-native';
import RNFS from 'react-native-fs';
import { Parser } from '@json2csv/plainjs';

const JsonToCsv = ({ filteredActivity, isVisible, closeModal }) => {
    const [csvData, setCsvData] = useState('');
    const [customFileName, setCustomFileName] = useState('');

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
                if (item.hasOwnProperty(key)) {
                    filteredItem[key] = item[key];
                }
            });
            return filteredItem;
        });
    };

    const convertJsonToCsv = async (data) => {
        if (!data || data.length === 0) {
            console.log('Filtered data is empty.');
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
            setCsvData(csv);
            // console.log(csv);
            return csv;
        } catch (err) {
            console.error(err);
            return '';
        }
    };

    const downloadCsv = async () => {
        const csv = await convertJsonToCsv(filteredActivity);
        if (!csv) return;

        try {
            if (Platform.OS === 'android') {
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
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    console.error('Storage permission denied');
                    return;
                }
            }

            const dateTime = getFormattedDateTime();

            const fileName = customFileName
                ? `${customFileName}.csv`
                : `data_${dateTime}.csv`;
            const filePath = `${RNFS.DownloadDirectoryPath}/${fileName}`;

            await RNFS.writeFile(filePath, csv, 'utf8');
            Alert.alert('Success', 'CSV file has been downloaded');
            closeModal();
        } catch (err) {
            if (DocumentPicker.isCancel(err)) {
                console.log('User canceled the picker');
            } else {
                console.error('Failed to save CSV file:', err);
            }
        }
    };

    return (
        <Modal
            visible={isVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={closeModal}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalView}>
                    <TextInput
                        placeholder="File name (optional)"
                        value={customFileName}
                        onChangeText={setCustomFileName}
                        style={styles.textInput}
                    />
                    <View style={styles.buttonView}>
                        <TouchableOpacity
                            style={styles.buttonStyle}
                            onPress={downloadCsv}
                        >
                            <Text style={styles.buttonText}>Download CSV</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.buttonStyle}
                            onPress={closeModal}
                        >
                            <Text style={styles.buttonText}>Close</Text>
                        </TouchableOpacity>
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
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        alignItems: 'center'
    },
    textInput: {
        height: 40,
        borderColor: 'gray',
        borderWidth: 1,
        marginBottom: 20,
        width: '100%',
        paddingHorizontal: 10
    },
    buttonView: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    buttonStyle: {
        backgroundColor: '#007BFF',
        padding: 8,
        borderRadius: 5,
        alignItems: 'center',
        flex: 1,
        margin: 5
    },
    buttonText: {
        color: 'white',
        fontSize: 16
    }
});

export default JsonToCsv;
