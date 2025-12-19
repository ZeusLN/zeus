import React from 'react';
import { observer } from 'mobx-react';
import { View, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';
import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import Switch from '../../../components/Switch';

import { NWC_DEFAULT_FILTERS, NWCFilterState } from './NWCConnectionActivity';

interface NWCConnectionActivityFilterProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'NWCConnectionActivityFilter',
        {
            activeFilters: NWCFilterState;
            onApply: (filters: NWCFilterState) => void;
        }
    >;
}

interface NWCConnectionActivityFilterState {
    selectedFilters: NWCFilterState;
}

@observer
export default class NWCConnectionActivityFilter extends React.Component<
    NWCConnectionActivityFilterProps,
    NWCConnectionActivityFilterState
> {
    constructor(props: NWCConnectionActivityFilterProps) {
        super(props);
        const { activeFilters } = props.route.params;
        this.state = {
            selectedFilters: activeFilters || { ...NWC_DEFAULT_FILTERS }
        };
    }

    toggleFilter = (filterKey: keyof NWCFilterState) => {
        this.setState(
            (prev) => ({
                selectedFilters: {
                    ...prev.selectedFilters,
                    [filterKey]: !prev.selectedFilters[filterKey]
                }
            }),
            () => {
                // Apply filters immediately after toggling
                this.applyFilters();
            }
        );
    };

    applyFilters = () => {
        const { onApply } = this.props.route.params;
        if (onApply) {
            onApply(this.state.selectedFilters);
        }
    };

    clearFilters = () => {
        this.setState({ selectedFilters: { ...NWC_DEFAULT_FILTERS } }, () => {
            this.applyFilters();
        });
    };

    isDefaultFilter = (): boolean => {
        const { selectedFilters } = this.state;
        return (
            selectedFilters.sent === NWC_DEFAULT_FILTERS.sent &&
            selectedFilters.received === NWC_DEFAULT_FILTERS.received &&
            selectedFilters.failed === NWC_DEFAULT_FILTERS.failed &&
            selectedFilters.pending === NWC_DEFAULT_FILTERS.pending
        );
    };

    renderSeparator = () => (
        <View
            style={{ height: 0.4, backgroundColor: themeColor('separator') }}
        />
    );

    render() {
        const { selectedFilters } = this.state;
        const { navigation } = this.props;

        const FILTERS = [
            {
                label: localeString('general.sent'),
                value: selectedFilters.sent,
                key: 'sent' as keyof NWCFilterState
            },
            {
                label: localeString('general.received'),
                value: selectedFilters.received,
                key: 'received' as keyof NWCFilterState
            },
            {
                label: localeString('views.ActivityFilter.isFailed'),
                value: selectedFilters.failed,
                key: 'failed' as keyof NWCFilterState
            },
            {
                label: localeString('views.Wallet.Invoices.unpaid'),
                value: selectedFilters.pending,
                key: 'pending' as keyof NWCFilterState
            }
        ];

        const ClearButton = () => (
            <Icon
                name="delete"
                onPress={this.clearFilters}
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
                        !this.isDefaultFilter() ? <ClearButton /> : <></>
                    }
                    navigation={navigation}
                />

                <KeyboardAvoidingView
                    style={{ flex: 1, backgroundColor: 'transparent' }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <ScrollView>
                        {FILTERS.map((item, index) => (
                            <React.Fragment key={item.key}>
                                <ListItem
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor: 'transparent'
                                    }}
                                >
                                    <ListItem.Title
                                        style={{
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {item.label}
                                    </ListItem.Title>
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
                                                this.toggleFilter(item.key)
                                            }
                                        />
                                    </View>
                                </ListItem>
                                {index < FILTERS.length - 1 &&
                                    this.renderSeparator()}
                            </React.Fragment>
                        ))}
                    </ScrollView>
                </KeyboardAvoidingView>
            </Screen>
        );
    }
}
