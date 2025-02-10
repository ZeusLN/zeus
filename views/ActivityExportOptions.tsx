import * as React from 'react';
import {
    View,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Platform,
    ScrollView,
    Modal
} from 'react-native';
import RNFS from 'react-native-fs';
import Icon from 'react-native-vector-icons/Feather';
import { inject, observer } from 'mobx-react';

import Header from '../components/Header';
import Button from '../components/Button';
import TextInput from '../components/TextInput';
import Text from '../components/Text';
import LoadingIndicator from '../components/LoadingIndicator';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import ActivityStore from '../stores/ActivityStore';
import SettingsStore from '../stores/SettingsStore';

import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Transaction from '../models/Transaction';
import DatePicker from 'react-native-date-picker';
import { CheckBox } from 'react-native-elements';

interface ActivityExportOptionsProps {
    navigation: any;
    ActivityStore: ActivityStore;
    SettingsStore: SettingsStore;
}

interface ActivityExportOptionsState {
    isCsvLoading: boolean;
    isActivityFetching: boolean;
    filteredActivity: any;
    isModalVisible: boolean;
    customFileName: string;
    fromDate: any;
    toDate: any;
    exportType: any;
    downloadCompleteData: boolean;
}

@inject('ActivityStore', 'SettingsStore')
@observer
export default class ActivityExportOptions extends React.Component<
    ActivityExportOptionsProps,
    ActivityExportOptionsState
> {
    constructor(props: ActivityExportOptionsProps) {
        super(props);
        this.state = {
            isCsvLoading: false,
            isActivityFetching: true,
            filteredActivity: [],
            isModalVisible: false,
            customFileName: '',
            fromDate: null,
            toDate: null,
            exportType: '',
            downloadCompleteData: false
        };
    }

    componentDidMount() {
        this.fetchAndFilterActivity();
    }

    fetchAndFilterActivity = async () => {
        const { SettingsStore, ActivityStore } = this.props;
        const { locale } = SettingsStore.settings;

        try {
            // Call getActivityAndFilter to fetch and filter activity data
            await ActivityStore.getActivityAndFilter(locale);

            // Update filteredActivity in state
            this.setState({
                filteredActivity: ActivityStore.filteredActivity,
                isActivityFetching: false
            });
        } catch (err) {
            console.error('Failed to fetch activity data:', err);
            this.setState({ isActivityFetching: false });
            Alert.alert(localeString('general.error'));
        }
    };

    getFormattedDateTime = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');

        return `${year}${month}${day}_${hours}${minutes}${seconds}`;
    };

    convertActivityToCsv = async (
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

    filterDataByDate = (data: any) => {
        const { fromDate, toDate, downloadCompleteData } = this.state;
        if (!fromDate && !toDate) return data;

        if (downloadCompleteData) return data;

        return data.filter((item: any) => {
            const itemDate = new Date(item.getDate);
            if (isNaN(itemDate.getTime())) return false;
            if (fromDate && itemDate < fromDate) return false;
            if (toDate && itemDate > toDate) return false;
            return true;
        });
    };

    downloadCsv = async (type: 'invoice' | 'payment' | 'transaction') => {
        this.setState({ isCsvLoading: true }, async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
            let { filteredActivity } = this.state;

            if (!filteredActivity || filteredActivity.length === 0) {
                console.log('No activity data found, fetching again...');
                Alert.alert(
                    localeString('general.warning'),
                    localeString('views.ActivityToCsv.noData')
                );
                await this.fetchAndFilterActivity();
                this.setState({ isCsvLoading: false });
                return;
            }

            let keysToInclude: any;
            let filteredData: any;

            switch (type) {
                case 'invoice':
                    keysToInclude = [
                        { label: 'Amount Paid (sat)', value: 'getAmount' },
                        {
                            label: 'Payment Request',
                            value: 'getPaymentRequest'
                        },
                        { label: 'Payment Hash', value: 'getRHash' },
                        { label: 'Memo', value: 'getMemo' },
                        { label: 'Note', value: 'getNote' },
                        { label: 'Creation Date', value: 'getCreationDate' },
                        { label: 'Expiry', value: 'formattedTimeUntilExpiry' }
                    ];
                    filteredData = filteredActivity.filter(
                        (item: any) => item instanceof Invoice
                    );
                    break;

                case 'payment':
                    keysToInclude = [
                        { label: 'Destination', value: 'getDestination' },
                        {
                            label: 'Payment Request',
                            value: 'getPaymentRequest'
                        },
                        { label: 'Payment Hash', value: 'paymentHash' },
                        { label: 'Amount Paid (sat)', value: 'getAmount' },
                        { label: 'Memo', value: 'getMemo' },
                        { label: 'Note', value: 'getNote' },
                        { label: 'Creation Date', value: 'getDate' }
                    ];
                    filteredData = filteredActivity.filter(
                        (item: any) =>
                            item instanceof Payment && item?.getDestination
                    );
                    break;

                case 'transaction':
                    keysToInclude = [
                        { label: 'Transaction Hash', value: 'tx' },
                        { label: 'Amount (sat)', value: 'getAmount' },
                        { label: 'Total Fees (sat)', value: 'getFee' },
                        { label: 'Note', value: 'getNote' },
                        { label: 'Timestamp', value: 'getDate' }
                    ];
                    filteredData = filteredActivity.filter(
                        (item: any) => item instanceof Transaction
                    );
                    break;

                default:
                    keysToInclude = [];
                    filteredData = [];
                    break;
            }

            filteredData = this.filterDataByDate(filteredData);

            if (!filteredData || filteredData.length === 0) {
                console.log('No valid data found for', type);
                this.setState({ isCsvLoading: false });
                Alert.alert(
                    localeString('general.error'),
                    localeString('views.ActivityToCsv.noData')
                );
                return;
            }

            const csvData = await this.convertActivityToCsv(
                filteredData,
                keysToInclude
            );

            if (!csvData) {
                this.setState({ isCsvLoading: false });
                Alert.alert(
                    localeString('general.error'),
                    localeString('views.ActivityToCsv.noData')
                );
                return;
            }

            try {
                const dateTime = this.getFormattedDateTime();
                const baseFileName = this.state.customFileName
                    ? `${this.state.customFileName}.csv`
                    : `zeus_${dateTime}_${type}.csv`;
                const filePath =
                    Platform.OS === 'android'
                        ? `${RNFS.DownloadDirectoryPath}/${baseFileName}`
                        : `${RNFS.DocumentDirectoryPath}/${baseFileName}`;

                console.log('Saving file to:', filePath);

                this.setState({ isModalVisible: false });

                await RNFS.writeFile(filePath, csvData, 'utf8');

                this.closeAndClearInput();

                Alert.alert(
                    localeString('general.success'),
                    localeString('views.ActivityToCsv.csvDownloaded')
                );
            } catch (err) {
                console.error('Failed to save CSV file:', err);
                Alert.alert(
                    localeString('general.error'),
                    localeString('views.ActivityToCsv.csvDownloadFailed')
                );
            } finally {
                this.setState({ isCsvLoading: false });
            }
        });
    };

    closeAndClearInput = () => {
        this.setState({
            isModalVisible: false,
            customFileName: '',
            fromDate: new Date(),
            toDate: new Date(),
            downloadCompleteData: false
        });
    };

    openModal = (type: 'invoice' | 'transaction' | 'payment') =>
        this.setState({ isModalVisible: true, exportType: type });

    renderModal = () => {
        const {
            isModalVisible,
            isCsvLoading,
            customFileName,
            fromDate,
            toDate,
            downloadCompleteData
        } = this.state;
        return (
            <Modal
                visible={isModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={this.closeAndClearInput}
            >
                <View style={styles.modalOverlay}>
                    <View
                        style={{
                            width: '80%',
                            backgroundColor: themeColor('background'),
                            padding: 20,
                            borderRadius: 10,
                            alignItems: 'center'
                        }}
                    >
                        {isCsvLoading ? (
                            <LoadingIndicator />
                        ) : (
                            <>
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontSize: 18
                                    }}
                                >
                                    {localeString(
                                        'views.activityExport.dateRange'
                                    )}
                                </Text>
                                <View style={{ alignItems: 'center' }}>
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            marginBottom: 10
                                        }}
                                    >
                                        <CheckBox
                                            title={localeString(
                                                'views.activityExport.downloadCompleteData'
                                            )}
                                            checked={
                                                this.state.downloadCompleteData
                                            }
                                            onPress={() =>
                                                this.setState({
                                                    downloadCompleteData:
                                                        !downloadCompleteData,
                                                    fromDate:
                                                        !downloadCompleteData
                                                            ? null
                                                            : fromDate,
                                                    toDate: !downloadCompleteData
                                                        ? null
                                                        : toDate
                                                })
                                            }
                                            containerStyle={{
                                                backgroundColor: 'transparent',
                                                borderWidth: 0
                                            }}
                                            textStyle={{
                                                color: themeColor('text')
                                            }}
                                            checkedColor="green"
                                        />
                                    </View>
                                    {!downloadCompleteData && (
                                        <>
                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {localeString(
                                                    'views.activityExport.fromDate'
                                                )}
                                            </Text>
                                            <DatePicker
                                                mode="date"
                                                date={fromDate || new Date()}
                                                onDateChange={(date) => {
                                                    this.setState({
                                                        fromDate: date
                                                    });
                                                    if (
                                                        toDate &&
                                                        date > toDate
                                                    ) {
                                                        this.setState({
                                                            toDate: date
                                                        });
                                                    }
                                                }}
                                                style={{
                                                    height: 100,
                                                    marginTop: 10,
                                                    marginBottom: 20,
                                                    alignSelf: 'center'
                                                }}
                                                maximumDate={new Date()}
                                                textColor={themeColor('text')}
                                            />
                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    marginBottom: 5
                                                }}
                                            >
                                                {localeString(
                                                    'views.activityExport.toDate'
                                                )}
                                            </Text>
                                            <DatePicker
                                                mode="date"
                                                date={toDate || new Date()}
                                                onDateChange={(date) => {
                                                    if (
                                                        fromDate &&
                                                        date < fromDate
                                                    ) {
                                                        Alert.alert(
                                                            'Invalid Date'
                                                        );
                                                    } else {
                                                        this.setState({
                                                            toDate: date
                                                        });
                                                    }
                                                }}
                                                style={{
                                                    height: 100,
                                                    marginTop: 10,
                                                    marginBottom: 20,
                                                    alignSelf: 'center'
                                                }}
                                                maximumDate={new Date()}
                                                textColor={themeColor('text')}
                                            />
                                        </>
                                    )}
                                </View>

                                <TextInput
                                    placeholder={localeString(
                                        'views.ActivityToCsv.textInputPlaceholder'
                                    )}
                                    value={customFileName}
                                    onChangeText={(text: string) =>
                                        this.setState({
                                            customFileName: text
                                        })
                                    }
                                    style={{ marginHorizontal: 12 }}
                                />
                                <View style={styles.buttonContainer}>
                                    <Button
                                        title={localeString(
                                            'views.ActivityToCsv.downloadButton'
                                        )}
                                        onPress={() =>
                                            this.downloadCsv(
                                                this.state.exportType
                                            )
                                        }
                                        buttonStyle={{
                                            marginBottom: 10
                                        }}
                                    />
                                    <Button
                                        title={localeString('general.close')}
                                        onPress={this.closeAndClearInput}
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

    render() {
        const { isActivityFetching } = this.state;

        return (
            <ScrollView>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: 'Activity Export Options',
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={this.props.navigation}
                />
                {this.renderModal()}

                <View
                    style={{
                        ...styles.container,
                        backgroundColor: themeColor('background')
                    }}
                >
                    {isActivityFetching ? (
                        <LoadingIndicator />
                    ) : (
                        <>
                            <TouchableOpacity
                                style={{
                                    ...styles.optionButton,
                                    backgroundColor: themeColor('secondary')
                                }}
                                onPress={() => this.openModal('invoice')}
                            >
                                <Icon
                                    name="download"
                                    size={24}
                                    color={themeColor('text')}
                                />
                                <Text
                                    style={{
                                        ...styles.optionText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.activityExport.exportInvoices'
                                    )}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{
                                    ...styles.optionButton,
                                    backgroundColor: themeColor('secondary')
                                }}
                                onPress={() => this.openModal('payment')}
                            >
                                <Icon
                                    name="download"
                                    size={24}
                                    color={themeColor('text')}
                                />
                                <Text
                                    style={{
                                        ...styles.optionText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.activityExport.exportPayments'
                                    )}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{
                                    ...styles.optionButton,
                                    backgroundColor: themeColor('secondary')
                                }}
                                onPress={() => this.openModal('transaction')}
                            >
                                <Icon
                                    name="download"
                                    size={24}
                                    color={themeColor('text')}
                                />
                                <Text
                                    style={{
                                        ...styles.optionText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.activityExport.exportTransactions'
                                    )}
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        marginVertical: 10,
        borderRadius: 10
    },
    optionText: {
        marginLeft: 15,
        fontSize: 16
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    buttonContainer: {
        width: '100%',
        marginTop: 4
    }
});
