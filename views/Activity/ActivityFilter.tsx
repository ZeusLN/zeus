import * as React from 'react';
import {
    ScrollView,
    Text,
    View,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity
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

import CaretDown from '../../assets/images/SVG/Caret Down.svg';
import CaretRight from '../../assets/images/SVG/Caret Right.svg';

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
    expandedSections: {
        services: boolean;
        swaps: boolean;
        lsps1: boolean;
    };
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
        workingEndDate: new Date(),
        expandedSections: {
            services: false,
            swaps: false,
            lsps1: false
        }
    };

    handleToggle = async (path: string | string[]) => {
        const { ActivityStore, SettingsStore } = this.props;
        const { filters, setFilters } = ActivityStore;
        const locale = SettingsStore.settings.locale;

        const newFilters = JSON.parse(JSON.stringify(filters));

        if (path === 'services') {
            const isTurningOn = !(filters.swaps || filters.lsps1);
            newFilters.swaps = isTurningOn;
            newFilters.lsps1 = isTurningOn;

            Object.keys(newFilters.swapState).forEach((key) => {
                (newFilters.swapState as any)[key] = isTurningOn;
            });
            Object.keys(newFilters.lsps1OrderState).forEach((key) => {
                (newFilters.lsps1OrderState as any)[key] = isTurningOn;
            });

            if (!isTurningOn) {
                this.setState((prevState) => ({
                    expandedSections: {
                        ...prevState.expandedSections,
                        swaps: false,
                        lsps1: false
                    }
                }));
            }
        } else if (Array.isArray(path)) {
            const [parent, child] = path as [keyof Filter, string];
            const isTurningOn = !filters[parent]?.[child];
            newFilters[parent][child] = isTurningOn;

            if (isTurningOn) {
                if (parent === 'swapState') newFilters.swaps = true;
                if (parent === 'lsps1OrderState') newFilters.lsps1 = true;
            } else {
                const allChildrenOff = Object.values(newFilters[parent]).every(
                    (item) => item === false
                );
                if (allChildrenOff) {
                    if (parent === 'swapState') newFilters.swaps = false;
                    if (parent === 'lsps1OrderState') newFilters.lsps1 = false;
                }
            }
        } else {
            const key = path as keyof Filter;
            const isTurningOn = !filters[key];
            newFilters[key] = isTurningOn;

            if (key === 'swaps') {
                Object.keys(newFilters.swapState).forEach((key) => {
                    (newFilters.swapState as any)[key] = isTurningOn;
                });
            }
            if (key === 'lsps1') {
                Object.keys(newFilters.lsps1OrderState).forEach((key) => {
                    (newFilters.lsps1OrderState as any)[key] = isTurningOn;
                });
            }
        }

        await setFilters(newFilters, locale);
    };

    toggleSection = (
        sectionName: keyof ActivityFilterState['expandedSections']
    ) => {
        this.setState((prevState) => ({
            expandedSections: {
                ...prevState.expandedSections,
                [sectionName]: !prevState.expandedSections[sectionName]
            }
        }));
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
        const {
            setStartDate,
            setEndDate,
            workingStartDate,
            workingEndDate,
            expandedSections
        } = this.state;
        const locale = SettingsStore.settings.locale;
        const {
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
            lsps1,
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
                label: localeString('views.ActivityFilter.services'),
                type: 'Services',
                condition: true,
                section: 'services',
                children: [
                    {
                        label: localeString('views.Swaps.title'),
                        value: swaps,
                        var: 'swaps',
                        section: 'swaps',
                        children: [
                            {
                                label: `${localeString(
                                    'general.swap'
                                )} ${localeString(
                                    'views.ActivityFilter.swapState.created'
                                )}`,
                                var: ['swapState', 'created'],
                                type: 'Toggle'
                            },
                            {
                                label: `${localeString(
                                    'general.swap'
                                )} ${localeString(
                                    'views.ActivityFilter.swapState.successful'
                                )}`,
                                var: ['swapState', 'successful'],
                                type: 'Toggle'
                            },
                            {
                                label: `${localeString(
                                    'general.swap'
                                )} ${localeString(
                                    'views.ActivityFilter.swapState.failed'
                                )}`,
                                var: ['swapState', 'failed'],
                                type: 'Toggle'
                            },
                            {
                                label: `${localeString(
                                    'general.swap'
                                )} ${localeString(
                                    'views.ActivityFilter.swapState.refunded'
                                )}`,
                                var: ['swapState', 'refunded'],
                                type: 'Toggle'
                            }
                        ]
                    },
                    {
                        label: localeString('views.LSPS1.lsps1Orders'),
                        value: lsps1,
                        var: 'lsps1',
                        section: 'lsps1',
                        children: [
                            {
                                label: localeString(
                                    'views.ActivityFilter.swapState.created'
                                ),
                                var: ['lsps1OrderState', 'CREATED'],
                                type: 'Toggle'
                            },
                            {
                                label: localeString(
                                    'views.ActivityFilter.lsps1OrderState.completed'
                                ),
                                var: ['lsps1OrderState', 'COMPLETED'],
                                type: 'Toggle'
                            },
                            {
                                label: localeString(
                                    'views.ActivityFilter.swapState.failed'
                                ),
                                var: ['lsps1OrderState', 'FAILED'],
                                type: 'Toggle'
                            }
                        ]
                    }
                ]
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
                            if (item.type === 'Services') {
                                return (
                                    <React.Fragment key={item.label}>
                                        <TouchableOpacity
                                            onPress={() =>
                                                this.toggleSection('services')
                                            }
                                        >
                                            <ListItem
                                                containerStyle={{
                                                    borderBottomWidth: 0,
                                                    backgroundColor:
                                                        'transparent'
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        marginRight: 0,
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    {expandedSections.services ? (
                                                        <CaretDown
                                                            fill={themeColor(
                                                                'text'
                                                            )}
                                                            width={24}
                                                            height={24}
                                                        />
                                                    ) : (
                                                        <CaretRight
                                                            fill={themeColor(
                                                                'text'
                                                            )}
                                                            width={24}
                                                            height={24}
                                                        />
                                                    )}
                                                </View>
                                                <ListItem.Content>
                                                    <ListItem.Title
                                                        style={{
                                                            color: themeColor(
                                                                'text'
                                                            ),
                                                            fontFamily:
                                                                'PPNeueMontreal-Book'
                                                        }}
                                                    >
                                                        {item.label}
                                                    </ListItem.Title>
                                                </ListItem.Content>
                                                <Switch
                                                    value={swaps || lsps1}
                                                    onValueChange={() =>
                                                        this.handleToggle(
                                                            'services'
                                                        )
                                                    }
                                                />
                                            </ListItem>
                                        </TouchableOpacity>

                                        {expandedSections.services && (
                                            <View style={{ paddingLeft: 20 }}>
                                                {this.renderSeparator()}
                                                {item.children?.map(
                                                    (child, childIndex) => {
                                                        const isChildExpanded =
                                                            expandedSections[
                                                                child.section as keyof typeof expandedSections
                                                            ];
                                                        return (
                                                            <React.Fragment
                                                                key={child.var}
                                                            >
                                                                <TouchableOpacity
                                                                    onPress={() =>
                                                                        this.toggleSection(
                                                                            child.section as any
                                                                        )
                                                                    }
                                                                >
                                                                    <ListItem
                                                                        containerStyle={{
                                                                            borderBottomWidth: 0,
                                                                            backgroundColor:
                                                                                'transparent'
                                                                        }}
                                                                    >
                                                                        <View
                                                                            style={{
                                                                                marginRight: 0,
                                                                                justifyContent:
                                                                                    'center'
                                                                            }}
                                                                        >
                                                                            {isChildExpanded ? (
                                                                                <CaretDown
                                                                                    fill={themeColor(
                                                                                        'text'
                                                                                    )}
                                                                                    width={
                                                                                        24
                                                                                    }
                                                                                    height={
                                                                                        24
                                                                                    }
                                                                                />
                                                                            ) : (
                                                                                <CaretRight
                                                                                    fill={themeColor(
                                                                                        'text'
                                                                                    )}
                                                                                    width={
                                                                                        24
                                                                                    }
                                                                                    height={
                                                                                        24
                                                                                    }
                                                                                />
                                                                            )}
                                                                        </View>
                                                                        <ListItem.Content>
                                                                            <ListItem.Title
                                                                                style={{
                                                                                    color: themeColor(
                                                                                        'text'
                                                                                    ),
                                                                                    fontFamily:
                                                                                        'PPNeueMontreal-Book'
                                                                                }}
                                                                            >
                                                                                {
                                                                                    child.label
                                                                                }
                                                                            </ListItem.Title>
                                                                        </ListItem.Content>

                                                                        <Switch
                                                                            value={
                                                                                filters[
                                                                                    child.var as keyof Filter
                                                                                ]
                                                                            }
                                                                            onValueChange={() =>
                                                                                this.handleToggle(
                                                                                    child.var as string
                                                                                )
                                                                            }
                                                                        />
                                                                    </ListItem>
                                                                </TouchableOpacity>
                                                                {isChildExpanded && (
                                                                    <View
                                                                        style={{
                                                                            paddingLeft: 20
                                                                        }}
                                                                    >
                                                                        {this.renderSeparator()}
                                                                        {child.children.map(
                                                                            (
                                                                                grandchild,
                                                                                grandchildIndex
                                                                            ) => (
                                                                                <React.Fragment
                                                                                    key={grandchild.var.join(
                                                                                        '-'
                                                                                    )}
                                                                                >
                                                                                    <ListItem
                                                                                        key={grandchild.var.join(
                                                                                            '-'
                                                                                        )}
                                                                                        containerStyle={{
                                                                                            backgroundColor:
                                                                                                'transparent'
                                                                                        }}
                                                                                    >
                                                                                        <ListItem.Content>
                                                                                            <ListItem.Title
                                                                                                style={{
                                                                                                    color: themeColor(
                                                                                                        'text'
                                                                                                    )
                                                                                                }}
                                                                                            >
                                                                                                {
                                                                                                    grandchild.label
                                                                                                }
                                                                                            </ListItem.Title>
                                                                                        </ListItem.Content>

                                                                                        <Switch
                                                                                            value={
                                                                                                filters[
                                                                                                    grandchild
                                                                                                        .var[0]
                                                                                                ]?.[
                                                                                                    grandchild
                                                                                                        .var[1]
                                                                                                ] ||
                                                                                                false
                                                                                            }
                                                                                            onValueChange={() =>
                                                                                                this.handleToggle(
                                                                                                    grandchild.var
                                                                                                )
                                                                                            }
                                                                                        />
                                                                                    </ListItem>
                                                                                    {grandchildIndex <
                                                                                        child
                                                                                            .children
                                                                                            .length -
                                                                                            1 &&
                                                                                        this.renderSeparator()}
                                                                                </React.Fragment>
                                                                            )
                                                                        )}
                                                                    </View>
                                                                )}
                                                                {childIndex <
                                                                    item
                                                                        .children
                                                                        .length -
                                                                        1 &&
                                                                    this.renderSeparator()}
                                                            </React.Fragment>
                                                        );
                                                    }
                                                )}
                                            </View>
                                        )}
                                        {this.renderSeparator()}
                                    </React.Fragment>
                                );
                            }

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
                                                    onValueChange={() =>
                                                        this.handleToggle(
                                                            item.var as string
                                                        )
                                                    }
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
