import * as React from 'react';
import {
    ScrollView,
    Text,
    View,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { Button, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import isEqual from 'lodash/isEqual';
import DatePicker from 'react-native-date-picker';
import { StackNavigationProp } from '@react-navigation/stack';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import ActivityStore, {
    DEFAULT_FILTERS,
    Filter
} from '../../stores/ActivityStore';
import SettingsStore from '../../stores/SettingsStore';

import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import TextInput from '../../components/TextInput';

interface ActivityFilterProps {
    navigation: StackNavigationProp<any, any>;
    ActivityStore: ActivityStore;
    SettingsStore: SettingsStore;
}

interface ActivityFilterState {
    setStartDate: boolean;
    setEndDate: boolean;
    workingStartDate: any;
    workingEndDate: any;
}

@inject('ActivityStore', 'SettingsStore')
@observer
export default class ActivityFilter extends React.Component<
    ActivityFilterProps,
    ActivityFilterState
> {
    state = {
        setStartDate: false,
        setEndDate: false,
        workingStartDate: new Date(),
        workingEndDate: new Date()
    };

    renderSeparator = () => (
        <View
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    render() {
        const { navigation, ActivityStore, SettingsStore } = this.props;
        const { setStartDate, setEndDate, workingStartDate, workingEndDate } =
            this.state;
        const locale = SettingsStore.settings.locale;
        const {
            setFilters,
            filters,
            setAmountFilter,
            setMaximumAmountFilter,
            setStartDateFilter,
            setEndDateFilter,
            clearStartDateFilter,
            clearEndDateFilter,
            setMemoFilter
        } = ActivityStore;
        const {
            lightning,
            onChain,
            cashu,
            swaps,
            sent,
            received,
            unpaid,
            inTransit,
            isFailed,
            unconfirmed,
            standardInvoices,
            ampInvoices,
            zeusPay,
            minimumAmount,
            maximumAmount,
            startDate,
            endDate,
            memo,
            keysend
        } = filters;

        const DateFilter = (props: { type: 'startDate' | 'endDate' }) => (
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    alignItems: 'center'
                }}
            >
                <Text
                    style={{
                        fontFamily: 'PPNeueMontreal-Book',
                        color: themeColor('text'),
                        marginRight: 30
                    }}
                >
                    {(props.type === 'startDate'
                        ? startDate
                        : endDate
                    )?.toLocaleDateString(locale)}
                </Text>
                <Button
                    onPress={() => {
                        if (props.type === 'startDate') {
                            this.setState({
                                setStartDate: true,
                                workingStartDate: startDate
                                    ? startDate
                                    : endDate ?? new Date()
                            });
                        } else {
                            this.setState({
                                setEndDate: true,
                                workingEndDate: endDate ? endDate : new Date()
                            });
                        }
                    }}
                    buttonStyle={{
                        backgroundColor: themeColor('secondary'),
                        paddingLeft: 15,
                        paddingRight: 15,
                        height: 40
                    }}
                    titleStyle={{
                        color: themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book'
                    }}
                    title={
                        (props.type === 'startDate' && startDate) ||
                        (props.type === 'endDate' && endDate)
                            ? localeString('views.ActivityFilter.edit')
                            : localeString('views.ActivityFilter.set')
                    }
                />
                {((props.type === 'startDate' && startDate) ||
                    (props.type === 'endDate' && endDate)) && (
                    <Button
                        buttonStyle={{
                            backgroundColor: themeColor('secondary'),
                            marginLeft: 15,
                            height: 40
                        }}
                        icon={{
                            name: 'delete',
                            size: 20,
                            color: themeColor('text')
                        }}
                        onPress={() => {
                            props.type === 'startDate'
                                ? clearStartDateFilter()
                                : clearEndDateFilter();
                        }}
                    />
                )}
            </View>
        );

        const FILTERS = [
            {
                label: localeString('views.ActivityFilter.lightningPayments'),
                value: lightning,
                var: 'lightning',
                type: 'Toggle',
                condition: true
            },
            {
                label: localeString('views.ActivityFilter.onChainPayments'),
                value: onChain,
                var: 'onChain',
                type: 'Toggle',
                condition:
                    BackendUtils.supportsOnchainReceiving() ||
                    BackendUtils.supportsOnchainSends()
            },
            {
                label: localeString('views.ActivityFilter.cashuPayments'),
                value: cashu,
                var: 'cashu',
                type: 'Toggle',
                condition: BackendUtils.supportsCashuWallet()
            },
            {
                label: localeString('views.Swaps.title'),
                value: swaps,
                var: 'swaps',
                type: 'Toggle',
                condition: true
            },
            {
                label: localeString('general.sent'),
                value: sent,
                var: 'sent',
                type: 'Toggle',
                condition: true
            },
            {
                label: localeString('general.received'),
                value: received,
                var: 'received',
                type: 'Toggle',
                condition: true
            },
            {
                label: localeString('views.Wallet.Invoices.unpaid'),
                value: unpaid,
                var: 'unpaid',
                type: 'Toggle',
                condition: true
            },
            {
                label: localeString('views.ActivityFilter.inTransit'),
                value: inTransit,
                var: 'inTransit',
                type: 'Toggle',
                condition: BackendUtils.isLNDBased()
            },
            {
                label: localeString('views.ActivityFilter.isFailed'),
                value: isFailed,
                var: 'isFailed',
                type: 'Toggle',
                condition: BackendUtils.isLNDBased()
            },
            {
                label: localeString('views.ActivityFilter.standardInvoices'),
                value: standardInvoices,
                var: 'standardInvoices',
                type: 'Toggle',
                condition: BackendUtils.isLNDBased()
            },
            {
                label: localeString('views.ActivityFilter.ampInvoices'),
                value: ampInvoices,
                var: 'ampInvoices',
                type: 'Toggle',
                condition: BackendUtils.isLNDBased()
            },
            {
                label: 'ZEUS Pay',
                value: zeusPay,
                var: 'zeusPay',
                type: 'Toggle',
                condition: SettingsStore.settings.lightningAddress.enabled
            },
            {
                label: localeString('views.Channel.keysend'),
                value: keysend,
                var: 'keysend',
                type: 'Toggle',
                condition: BackendUtils.supportsKeysend()
            },
            {
                label: localeString('general.unconfirmed'),
                value: unconfirmed,
                var: 'unconfirmed',
                type: 'Toggle',
                condition: BackendUtils.supportsOnchainReceiving()
            },
            {
                label: localeString('views.ActivityFilter.minimumAmount'),
                value: minimumAmount,
                type: 'Amount',
                condition: true
            },
            {
                label: localeString('views.ActivityFilter.maximumAmount'),
                value: maximumAmount,
                type: 'Amount',
                condition: true
            },
            {
                label: localeString('views.ActivityFilter.startDate'),
                type: 'StartDate',
                condition: true
            },
            {
                label: localeString('views.ActivityFilter.endDate'),
                type: 'EndDate',
                condition: true
            },
            {
                label: localeString('views.ActivityFilter.memo'),
                value: memo,
                type: 'TextInput',
                condition: true
            }
        ];

        const ClearButton = () => (
            <Icon
                name="delete"
                onPress={async () => await ActivityStore.resetFilters()}
                color={themeColor('text')}
                underlayColor="transparent"
                accessibilityLabel={localeString('general.clearChanges')}
                size={30}
            />
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.ActivityFilter.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        isEqual(filters, DEFAULT_FILTERS) ? (
                            <></>
                        ) : (
                            <ClearButton />
                        )
                    }
                    navigation={navigation}
                />
                <KeyboardAvoidingView
                    style={{ flex: 1, backgroundColor: 'transparent' }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <ScrollView>
                        {FILTERS.map((item, index) => {
                            if (!item.condition) return null;

                            return (
                                <React.Fragment key={index}>
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: 'transparent'
                                        }}
                                    >
                                        <ListItem.Title
                                            style={{
                                                color: themeColor('text'),
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            {item.label}
                                        </ListItem.Title>
                                        {item.type === 'Toggle' && (
                                            <View
                                                style={{
                                                    flex: 1,
                                                    flexDirection: 'row',
                                                    justifyContent: 'flex-end'
                                                }}
                                            >
                                                <Switch
                                                    value={item.value}
                                                    onValueChange={async () => {
                                                        const newFilters: any =
                                                            {
                                                                ...filters
                                                            };
                                                        const toggledFilterKey =
                                                            item.var as keyof Filter;
                                                        const primaryFilterKeys: (keyof Filter)[] =
                                                            [
                                                                'lightning',
                                                                'onChain',
                                                                'cashu',
                                                                'swaps'
                                                            ];

                                                        const isTurningOn =
                                                            !newFilters[
                                                                toggledFilterKey
                                                            ];
                                                        newFilters[
                                                            toggledFilterKey
                                                        ] = isTurningOn;

                                                        if (
                                                            primaryFilterKeys.includes(
                                                                toggledFilterKey
                                                            ) &&
                                                            isTurningOn
                                                        ) {
                                                            primaryFilterKeys.forEach(
                                                                (typeKey) => {
                                                                    if (
                                                                        typeKey !==
                                                                        toggledFilterKey
                                                                    ) {
                                                                        newFilters[
                                                                            typeKey
                                                                        ] = false;
                                                                    }
                                                                }
                                                            );
                                                        }

                                                        const allPrimaryFilterOff =
                                                            primaryFilterKeys.every(
                                                                (typeKey) =>
                                                                    !newFilters[
                                                                        typeKey
                                                                    ]
                                                            );
                                                        if (
                                                            allPrimaryFilterOff
                                                        ) {
                                                            primaryFilterKeys.forEach(
                                                                (typeKey) => {
                                                                    newFilters[
                                                                        typeKey
                                                                    ] = true;
                                                                }
                                                            );
                                                        }

                                                        await setFilters(
                                                            newFilters,
                                                            locale
                                                        );
                                                    }}
                                                />
                                            </View>
                                        )}
                                        {item.type === 'Amount' && (
                                            <View style={{ flex: 1 }}>
                                                <TextInput
                                                    keyboardType="numeric"
                                                    placeholder={
                                                        item.label ===
                                                        localeString(
                                                            'views.ActivityFilter.minimumAmount'
                                                        )
                                                            ? '0'
                                                            : localeString(
                                                                  'views.ActivityFilter.maximumAmountPlaceHolder'
                                                              )
                                                    }
                                                    value={
                                                        item.value ===
                                                            undefined ||
                                                        item.value === 0
                                                            ? ''
                                                            : String(item.value)
                                                    }
                                                    onChangeText={(
                                                        text: string
                                                    ) => {
                                                        const newAmount =
                                                            text.trim() ===
                                                                '' &&
                                                            item.label ===
                                                                localeString(
                                                                    'views.ActivityFilter.minimumAmount'
                                                                )
                                                                ? 0
                                                                : text.trim() ===
                                                                      '' &&
                                                                  item.label ===
                                                                      localeString(
                                                                          'views.ActivityFilter.maximumAmount'
                                                                      )
                                                                ? undefined
                                                                : text.trim() !==
                                                                  ''
                                                                ? !isNaN(
                                                                      Number(
                                                                          text
                                                                      )
                                                                  )
                                                                    ? Number(
                                                                          text
                                                                      )
                                                                    : 0
                                                                : 0;

                                                        if (
                                                            item.label ===
                                                            localeString(
                                                                'views.ActivityFilter.minimumAmount'
                                                            )
                                                        ) {
                                                            setAmountFilter(
                                                                newAmount
                                                            );
                                                        } else if (
                                                            item.label ===
                                                            localeString(
                                                                'views.ActivityFilter.maximumAmount'
                                                            )
                                                        ) {
                                                            setMaximumAmountFilter(
                                                                newAmount
                                                            );
                                                        }
                                                    }}
                                                    style={{
                                                        marginBottom: 0,
                                                        top: 0
                                                    }}
                                                />
                                            </View>
                                        )}
                                        {item.type === 'TextInput' && (
                                            <View style={{ flex: 1 }}>
                                                <TextInput
                                                    placeholder={localeString(
                                                        'views.ActivityFilter.memoPlaceHolder'
                                                    )}
                                                    value={item.value}
                                                    onChangeText={async (
                                                        text: string
                                                    ) => {
                                                        const newMemo = text;
                                                        const newFilters = {
                                                            ...filters
                                                        };
                                                        newFilters.memo =
                                                            newMemo;
                                                        setMemoFilter(
                                                            newFilters.memo
                                                        );
                                                    }}
                                                    style={{
                                                        marginBottom: 0,
                                                        top: 0
                                                    }}
                                                />
                                            </View>
                                        )}
                                        {item.type === 'StartDate' && (
                                            <View style={{ flex: 1 }}>
                                                <DateFilter type="startDate" />
                                            </View>
                                        )}
                                        {item.type === 'EndDate' && (
                                            <View style={{ flex: 1 }}>
                                                <DateFilter type="endDate" />
                                            </View>
                                        )}
                                    </ListItem>
                                    {index < FILTERS.length - 1 &&
                                        this.renderSeparator()}
                                </React.Fragment>
                            );
                        })}
                    </ScrollView>

                    <DatePicker
                        onConfirm={(date) => {
                            if (setStartDate) {
                                this.setState({
                                    workingStartDate: date,
                                    setStartDate: false
                                });
                                setStartDateFilter(date);
                            } else {
                                this.setState({
                                    workingEndDate: date,
                                    setEndDate: false
                                });
                                setEndDateFilter(date);
                            }
                        }}
                        onCancel={() =>
                            this.setState({
                                setStartDate: false,
                                setEndDate: false
                            })
                        }
                        date={setStartDate ? workingStartDate : workingEndDate}
                        minimumDate={
                            setStartDate
                                ? undefined
                                : startDate
                                ? startDate
                                : undefined
                        }
                        maximumDate={
                            setStartDate
                                ? endDate
                                    ? endDate
                                    : new Date()
                                : new Date()
                        }
                        mode="date"
                        style={{
                            height: 100,
                            marginTop: 10,
                            marginBottom: 20,
                            alignSelf: 'center'
                        }}
                        modal
                        open={setStartDate || setEndDate}
                        locale={locale}
                    />
                </KeyboardAvoidingView>
            </Screen>
        );
    }
}
