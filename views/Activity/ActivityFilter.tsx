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
    Filter,
    SERVICES_CONFIG
} from '../../stores/ActivityStore';
import SettingsStore from '../../stores/SettingsStore';
import SwapStore from '../../stores/SwapStore';

import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import TextInput from '../../components/TextInput';

import { LSPOrderState } from '../../models/LSP';
import { SwapState } from '../../models/Swap';

import CaretDown from '../../assets/images/SVG/Caret Down.svg';
import CaretRight from '../../assets/images/SVG/Caret Right.svg';

interface ActivityFilterProps {
    navigation: StackNavigationProp<any, any>;
    ActivityStore: ActivityStore;
    SettingsStore: SettingsStore;
    SwapStore: SwapStore;
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
        lsps7: boolean;
        submarine: boolean;
        reverse: boolean;
    };
}

@inject('ActivityStore', 'SettingsStore', 'SwapStore')
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
            lsps1: false,
            lsps7: false,
            submarine: false,
            reverse: false
        }
    };

    getParentState = (children: boolean[]): 'off' | 'partial' | 'full' => {
        if (children.every((state) => state === true)) {
            return 'full';
        }
        if (children.every((state) => state === false)) {
            return 'off';
        }
        return 'partial';
    };

    getCombinedState = (
        childStatuses: ('off' | 'partial' | 'full')[]
    ): 'off' | 'partial' | 'full' => {
        if (childStatuses.every((status) => status === 'full')) {
            return 'full';
        }
        if (childStatuses.every((status) => status === 'off')) {
            return 'off';
        }
        return 'partial';
    };

    updateAllChildStates = (filterState: any, newValue: boolean) => {
        const newState = { ...filterState };

        if (newState) {
            Object.keys(newState).forEach((key) => {
                newState[key] = newValue;
            });
        }
        return newState;
    };

    handleToggle = async (path: string | (string | SwapState)[]) => {
        const { ActivityStore, SettingsStore } = this.props;
        const { filters, setFilters } = ActivityStore;
        const locale = SettingsStore.settings.locale;

        const newFilters = JSON.parse(JSON.stringify(filters));

        const toggleAllSwapFilters = (shouldTurnOn: boolean) => {
            newFilters.swaps = shouldTurnOn;
            newFilters.submarine = shouldTurnOn;
            newFilters.reverse = shouldTurnOn;
            Object.keys(newFilters.swapFilter.submarine).forEach(
                (s) =>
                    (newFilters.swapFilter.submarine[s as SwapState] =
                        shouldTurnOn)
            );
            Object.keys(newFilters.swapFilter.reverse).forEach(
                (s) =>
                    (newFilters.swapFilter.reverse[s as SwapState] =
                        shouldTurnOn)
            );
        };

        if (Array.isArray(path)) {
            const [group, state] = path as [
                'submarine' | 'reverse' | 'lsps1State' | 'lsps7State',
                any
            ];

            if (group === 'submarine' || group === 'reverse') {
                const swapState = state as SwapState;
                const isTurningOn = !filters.swapFilter[group][swapState];
                newFilters.swapFilter[group][swapState] = isTurningOn;

                if (isTurningOn) {
                    newFilters[group] = true;
                    newFilters.swaps = true;
                } else {
                    const allChildrenOff = Object.values(
                        newFilters.swapFilter[group]
                    ).every((c) => c === false);
                    if (allChildrenOff) {
                        newFilters[group] = false;
                    }
                }
            } else {
                const parentStateKey = group;
                const childKey = state as LSPOrderState;
                const isTurningOn = !filters[parentStateKey]?.[childKey];
                newFilters[parentStateKey][childKey] = isTurningOn;

                const parentToggleKey = Object.keys(SERVICES_CONFIG).find(
                    (key) =>
                        SERVICES_CONFIG[key as keyof typeof SERVICES_CONFIG] ===
                        parentStateKey
                );

                if (parentToggleKey) {
                    if (isTurningOn) {
                        newFilters[parentToggleKey] = true;
                    } else {
                        const allChildrenOff = Object.values(
                            newFilters[parentStateKey]
                        ).every((c) => c === false);
                        if (allChildrenOff) newFilters[parentToggleKey] = false;
                    }
                }
            }
        } else {
            const key = path;
            switch (key) {
                case 'services': {
                    const parentKeys = Object.keys(SERVICES_CONFIG);
                    const parentStates = parentKeys.map(
                        (k) => filters[k as keyof Filter]
                    );
                    const isTurningOn =
                        this.getParentState(parentStates) === 'off';

                    toggleAllSwapFilters(isTurningOn);

                    ['lsps1', 'lsps7'].forEach((serviceKey) => {
                        newFilters[serviceKey] = isTurningOn;
                        const stateKey =
                            SERVICES_CONFIG[
                                serviceKey as keyof typeof SERVICES_CONFIG
                            ];
                        newFilters[stateKey] = this.updateAllChildStates(
                            newFilters[stateKey],
                            isTurningOn
                        );
                    });
                    break;
                }

                case 'swaps': {
                    const isTurningOn = !filters.swaps;
                    toggleAllSwapFilters(isTurningOn);
                    break;
                }

                case 'submarine':
                case 'reverse': {
                    const sectionName = key;
                    const isTurningOn = !filters[sectionName];
                    newFilters[sectionName] = isTurningOn;

                    Object.keys(newFilters.swapFilter[sectionName]).forEach(
                        (stateKey) =>
                            (newFilters.swapFilter[sectionName][
                                stateKey as SwapState
                            ] = isTurningOn)
                    );

                    if (isTurningOn) {
                        newFilters.swaps = true;
                    } else {
                        const otherSection =
                            key === 'submarine' ? 'reverse' : 'submarine';
                        if (filters[otherSection] === false) {
                            newFilters.swaps = false;
                        }
                    }
                    break;
                }

                case 'lsps1':
                case 'lsps7': {
                    const childStateKey =
                        SERVICES_CONFIG[key as keyof typeof SERVICES_CONFIG];
                    const childrenStates = Object.values(
                        filters[childStateKey] || {}
                    );
                    const isTurningOn =
                        this.getParentState(childrenStates as boolean[]) ===
                        'off';
                    newFilters[key] = isTurningOn;
                    newFilters[childStateKey] = this.updateAllChildStates(
                        newFilters[childStateKey],
                        isTurningOn
                    );
                    break;
                }

                default: {
                    if (key in newFilters) {
                        newFilters[key] = !filters[key];
                    }
                    break;
                }
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
            style={{ height: 0.4, backgroundColor: themeColor('separator') }}
        />
    );

    render() {
        const { navigation, ActivityStore, SettingsStore, SwapStore } =
            this.props;
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
            lsps7,
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

        const submarineState = this.getParentState(
            Object.values(filters.swapFilter.submarine)
        );
        const reverseState = this.getParentState(
            Object.values(filters.swapFilter.reverse)
        );
        const swapsState = this.getCombinedState([
            submarineState,
            reverseState
        ]);
        const lsps1State = this.getParentState(
            Object.values(filters.lsps1State)
        );
        const lsps7State = this.getParentState(
            Object.values(filters.lsps7State)
        );
        const servicesState = this.getCombinedState([
            swapsState,
            lsps1State,
            lsps7State
        ]);

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
                                label: localeString('views.Swaps.submarine'),
                                section: 'submarine',
                                states: [
                                    SwapState.InvoiceSet,
                                    SwapState.TransactionClaimPending,
                                    SwapState.TransactionMempool,
                                    SwapState.TransactionConfirmed,
                                    SwapState.TransactionClaimed,
                                    SwapState.InvoicePending,
                                    SwapState.InvoicePaid,
                                    SwapState.TransactionRefunded,
                                    SwapState.InvoiceFailedToPay,
                                    SwapState.SwapExpired,
                                    SwapState.TransactionLockupFailed
                                ]
                            },
                            {
                                label: localeString('views.Swaps.reverse'),
                                section: 'reverse',
                                states: [
                                    SwapState.Created,
                                    SwapState.TransactionMempool,
                                    SwapState.TransactionFailed,
                                    SwapState.TransactionConfirmed,
                                    SwapState.InvoiceSettled,
                                    SwapState.TransactionRefunded,
                                    SwapState.SwapExpired,
                                    SwapState.InvoiceExpired
                                ]
                            }
                        ]
                    },
                    {
                        label: localeString('views.LSPS1.type'),
                        value: lsps1,
                        var: 'lsps1',
                        section: 'lsps1',
                        children: [
                            {
                                label: localeString(
                                    'views.ActivityFilter.swapState.created'
                                ),
                                var: ['lsps1State', LSPOrderState.CREATED],
                                type: 'Toggle'
                            },
                            {
                                label: localeString(
                                    'views.ActivityFilter.lsps1State.completed'
                                ),
                                var: ['lsps1State', LSPOrderState.COMPLETED],
                                type: 'Toggle'
                            },
                            {
                                label: localeString('general.failed'),
                                var: ['lsps1State', LSPOrderState.FAILED],
                                type: 'Toggle'
                            }
                        ]
                    },
                    {
                        label: localeString('views.LSPS7.type'),
                        value: lsps7,
                        var: 'lsps7',
                        section: 'lsps7',
                        children: [
                            {
                                label: localeString(
                                    'views.ActivityFilter.swapState.created'
                                ),
                                var: ['lsps7State', LSPOrderState.CREATED],
                                type: 'Toggle'
                            },
                            {
                                label: localeString(
                                    'views.ActivityFilter.lsps1State.completed'
                                ),
                                var: ['lsps7State', LSPOrderState.COMPLETED],
                                type: 'Toggle'
                            },
                            {
                                label: localeString('general.failed'),
                                var: ['lsps7State', LSPOrderState.FAILED],
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
                                                    value={
                                                        servicesState !== 'off'
                                                    }
                                                    trackEnabledColor={
                                                        servicesState ===
                                                        'partial'
                                                            ? themeColor(
                                                                  'secondaryText'
                                                              )
                                                            : themeColor(
                                                                  'highlight'
                                                              )
                                                    }
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
                                                        const childSwitchState =
                                                            child.var ===
                                                            'swaps'
                                                                ? swapsState
                                                                : child.var ===
                                                                  'lsps1'
                                                                ? lsps1State
                                                                : lsps7State;
                                                        if (
                                                            child.var ===
                                                            'swaps'
                                                        ) {
                                                            return (
                                                                <React.Fragment
                                                                    key={
                                                                        child.var
                                                                    }
                                                                >
                                                                    <TouchableOpacity
                                                                        onPress={() =>
                                                                            this.toggleSection(
                                                                                'swaps'
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
                                                                                    childSwitchState !==
                                                                                    'off'
                                                                                }
                                                                                trackEnabledColor={
                                                                                    childSwitchState ===
                                                                                    'partial'
                                                                                        ? themeColor(
                                                                                              'secondaryText'
                                                                                          )
                                                                                        : themeColor(
                                                                                              'highlight'
                                                                                          )
                                                                                }
                                                                                onValueChange={() =>
                                                                                    this.handleToggle(
                                                                                        'swaps'
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
                                                                                    subItem: any,
                                                                                    subIndex: number
                                                                                ) => {
                                                                                    const isSubItemExpanded =
                                                                                        expandedSections[
                                                                                            subItem.section as keyof typeof expandedSections
                                                                                        ];
                                                                                    const subItemSwitchState =
                                                                                        this.getParentState(
                                                                                            subItem.states.map(
                                                                                                (
                                                                                                    state: SwapState
                                                                                                ) =>
                                                                                                    filters
                                                                                                        .swapFilter[
                                                                                                        subItem.section as
                                                                                                            | 'submarine'
                                                                                                            | 'reverse'
                                                                                                    ][
                                                                                                        state
                                                                                                    ]
                                                                                            )
                                                                                        );
                                                                                    return (
                                                                                        <React.Fragment
                                                                                            key={
                                                                                                subItem.section
                                                                                            }
                                                                                        >
                                                                                            <TouchableOpacity
                                                                                                onPress={() =>
                                                                                                    this.toggleSection(
                                                                                                        subItem.section
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
                                                                                                            marginRight: 5,
                                                                                                            justifyContent:
                                                                                                                'center'
                                                                                                        }}
                                                                                                    >
                                                                                                        {isSubItemExpanded ? (
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
                                                                                                                )
                                                                                                            }}
                                                                                                        >
                                                                                                            {
                                                                                                                subItem.label
                                                                                                            }
                                                                                                        </ListItem.Title>
                                                                                                    </ListItem.Content>
                                                                                                    <Switch
                                                                                                        value={
                                                                                                            subItemSwitchState !==
                                                                                                            'off'
                                                                                                        }
                                                                                                        trackEnabledColor={
                                                                                                            subItemSwitchState ===
                                                                                                            'partial'
                                                                                                                ? themeColor(
                                                                                                                      'secondaryText'
                                                                                                                  )
                                                                                                                : themeColor(
                                                                                                                      'highlight'
                                                                                                                  )
                                                                                                        }
                                                                                                        onValueChange={() =>
                                                                                                            this.handleToggle(
                                                                                                                subItem.section
                                                                                                            )
                                                                                                        }
                                                                                                    />
                                                                                                </ListItem>
                                                                                            </TouchableOpacity>
                                                                                            {isSubItemExpanded && (
                                                                                                <View
                                                                                                    style={{
                                                                                                        paddingLeft: 20
                                                                                                    }}
                                                                                                >
                                                                                                    {this.renderSeparator()}
                                                                                                    {subItem.states.map(
                                                                                                        (
                                                                                                            stateEnum: SwapState,
                                                                                                            stateIndex: number
                                                                                                        ) => (
                                                                                                            <React.Fragment
                                                                                                                key={
                                                                                                                    stateEnum
                                                                                                                }
                                                                                                            >
                                                                                                                <ListItem
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
                                                                                                                            {SwapStore.formatStatus(
                                                                                                                                stateEnum
                                                                                                                            )}
                                                                                                                        </ListItem.Title>
                                                                                                                    </ListItem.Content>
                                                                                                                    <Switch
                                                                                                                        value={
                                                                                                                            filters
                                                                                                                                .swapFilter[
                                                                                                                                subItem.section as
                                                                                                                                    | 'submarine'
                                                                                                                                    | 'reverse'
                                                                                                                            ][
                                                                                                                                stateEnum
                                                                                                                            ] ||
                                                                                                                            false
                                                                                                                        }
                                                                                                                        onValueChange={() =>
                                                                                                                            this.handleToggle(
                                                                                                                                [
                                                                                                                                    subItem.section,
                                                                                                                                    stateEnum
                                                                                                                                ]
                                                                                                                            )
                                                                                                                        }
                                                                                                                    />
                                                                                                                </ListItem>
                                                                                                                {stateIndex <
                                                                                                                    subItem
                                                                                                                        .states
                                                                                                                        .length -
                                                                                                                        1 &&
                                                                                                                    this.renderSeparator()}
                                                                                                            </React.Fragment>
                                                                                                        )
                                                                                                    )}
                                                                                                </View>
                                                                                            )}
                                                                                            {subIndex <
                                                                                                child
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
                                                                    {childIndex <
                                                                        item
                                                                            .children
                                                                            .length -
                                                                            1 &&
                                                                        this.renderSeparator()}
                                                                </React.Fragment>
                                                            );
                                                        }

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
                                                                                childSwitchState !==
                                                                                'off'
                                                                            }
                                                                            trackEnabledColor={
                                                                                childSwitchState ===
                                                                                'partial'
                                                                                    ? themeColor(
                                                                                          'secondaryText'
                                                                                      )
                                                                                    : themeColor(
                                                                                          'highlight'
                                                                                      )
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
                                                                                    key={(
                                                                                        grandchild as any
                                                                                    ).var.join(
                                                                                        '-'
                                                                                    )}
                                                                                >
                                                                                    <ListItem
                                                                                        key={(
                                                                                            grandchild as any
                                                                                        ).var.join(
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
                                                                                                    (
                                                                                                        grandchild as any
                                                                                                    )
                                                                                                        .var[0]
                                                                                                ]?.[
                                                                                                    (
                                                                                                        grandchild as any
                                                                                                    )
                                                                                                        .var[1]
                                                                                                ] ||
                                                                                                false
                                                                                            }
                                                                                            onValueChange={() =>
                                                                                                this.handleToggle(
                                                                                                    (
                                                                                                        grandchild as any
                                                                                                    )
                                                                                                        .var
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
