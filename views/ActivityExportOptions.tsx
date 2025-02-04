import * as React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Platform,
    ScrollView,
    ActivityIndicator
} from 'react-native';
import RNFS from 'react-native-fs';
import Icon from 'react-native-vector-icons/Feather';
import { inject, observer } from 'mobx-react';

import Header from '../components/Header';
import LoadingIndicator from '../components/LoadingIndicator';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import ActivityStore from '../stores/ActivityStore';
import SettingsStore from '../stores/SettingsStore';

import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Transaction from '../models/Transaction';

interface ActivityExportOptionsProps {
    navigation: any;
    ActivityStore: ActivityStore;
    SettingsStore: SettingsStore;
}

interface ActivityExportOptionsState {
    isCsvLoading: boolean;
    isActivityFetching: boolean;
    filteredActivity: any;
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
            filteredActivity: []
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

    downloadCsv = async (type: 'invoice' | 'payment' | 'transaction') => {
        const { filteredActivity } = this.state;

        // If filteredActivity is empty, try fetching it again
        if (!filteredActivity || filteredActivity.length === 0) {
            Alert.alert(
                localeString('general.warning'),
                localeString('views.ActivityToCsv.noData')
            );
            await this.fetchAndFilterActivity();
            return;
        }

        this.setState({ isCsvLoading: true });

        let keysToInclude: any;
        let filteredData: any;

        switch (type) {
            case 'invoice':
                keysToInclude = [
                    { label: 'Amount Paid (sat)', value: 'getAmount' },
                    { label: 'Payment Request', value: 'getPaymentRequest' },
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
                    { label: 'Payment Request', value: 'getPaymentRequest' },
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
            const baseFileName = `zeus_${dateTime}_${type}.csv`;
            const filePath =
                Platform.OS === 'android'
                    ? `${RNFS.DownloadDirectoryPath}/${baseFileName}`
                    : `${RNFS.DocumentDirectoryPath}/${baseFileName}`;

            await RNFS.writeFile(filePath, csvData, 'utf8');

            this.setState({ isCsvLoading: false });

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
    };

    render() {
        const { isCsvLoading, isActivityFetching } = this.state;

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
                {isCsvLoading && (
                    <ActivityIndicator
                        size="large"
                        color={themeColor('text')}
                    />
                )}

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
                                onPress={() => this.downloadCsv('invoice')}
                                disabled={isCsvLoading}
                            >
                                <Icon
                                    name="file-text"
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
                                onPress={() => this.downloadCsv('payment')}
                                disabled={isCsvLoading}
                            >
                                <Icon
                                    name="credit-card"
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
                                onPress={() => this.downloadCsv('transaction')}
                                disabled={isCsvLoading}
                            >
                                <Icon
                                    name="dollar-sign"
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
    }
});
