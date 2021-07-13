import * as React from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Switch,
    Text,
    View
} from 'react-native';
import { Avatar, Button, Header, Icon, ListItem } from 'react-native-elements';
import Channel from './../models/Channel';
import { inject, observer } from 'mobx-react';
const hash = require('object-hash');
import DateTimeUtils from './../utils/DateTimeUtils';
import PrivacyUtils from './../utils/PrivacyUtils';
import { localeString } from './../utils/LocaleUtils';
import DatePicker from 'react-native-date-picker';

import ActivityStore from './../stores/ActivityStore';
import UnitsStore from './../stores/UnitsStore';
import SettingsStore from './../stores/SettingsStore';

interface ActivityFilterProps {
    navigation: any;
    ActivityStore: ActivityStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

interface ActivityFilterState {
    setStartDate: boolean;
    setEndDate: boolean;
    workingStartDate: any;
    workingEndDate: any;
}

@inject('ActivityStore', 'UnitsStore', 'SettingsStore')
@observer
export default class ActivityFilter extends React.Component<
    ActivityFilterProps,
    ActivityFilterState
> {
    state = {
        setStartDate: false,
        setEndDate: false,
        workingStartDate: null,
        workingEndDate: null
    };

    renderSeparator = () => {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const { theme } = settings;

        return (
            <View
                style={
                    theme === 'dark'
                        ? styles.darkSeparator
                        : styles.lightSeparator
                }
            />
        );
    };

    render() {
        const {
            navigation,
            ActivityStore,
            UnitsStore,
            SettingsStore
        } = this.props;
        const {
            setStartDate,
            setEndDate,
            workingStartDate,
            workingEndDate
        } = this.state;
        const { getAmount, units } = UnitsStore;
        const {
            loading,
            setFilters,
            filters,
            setStartDateFilter,
            setEndDateFilter,
            clearStartDateFilter,
            clearEndDateFilter
        } = ActivityStore;
        const {
            lightning,
            onChain,
            channels,
            sent,
            received,
            startDate,
            endDate
        } = filters;
        const { settings } = SettingsStore;
        const { theme, lurkerMode } = settings;

        const CloseButton = () => (
            <Icon
                name="close"
                onPress={() => navigation.navigate('Activity')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        const DateFilter = () => (
            <View
                style={{
                    flex: 1,
                    flexDirection: 'row',
                    justifyContent: 'flex-end'
                }}
            >
                <View style={{ padding: 5 }}>
                    <Button
                        onPress={() =>
                            startDate
                                ? clearStartDateFilter()
                                : this.setState({ setStartDate: !setStartDate })
                        }
                        buttonStyle={{ backgroundColor: 'white' }}
                        titleStyle={{ color: 'black' }}
                        title={startDate ? 'Clear Start' : 'Set Start'}
                    />
                </View>
                <View style={{ padding: 5 }}>
                    <Button
                        onPress={() =>
                            endDate
                                ? clearEndDateFilter()
                                : this.setState({ setEndDate: !setEndDate })
                        }
                        buttonStyle={{ backgroundColor: 'orange' }}
                        title={endDate ? 'Clear End' : 'Set End'}
                    />
                </View>
            </View>
        );

        const DateData = () => (
            <>
                <>
                    {startDate && (
                        <Text
                            style={{ color: 'white', paddingTop: 30 }}
                        >{`Start Date: ${startDate.toString()}`}</Text>
                    )}
                    {endDate && (
                        <Text
                            style={{ color: 'white', paddingTop: 30 }}
                        >{`End Date: ${endDate.toString()}`}</Text>
                    )}
                </>
                {(setStartDate || setEndDate) && (
                    <View
                        style={{
                            marginTop: 20
                        }}
                    >
                        <DatePicker
                            onDateChange={date =>
                                setStartDate
                                    ? this.setState({ workingStartDate: date })
                                    : this.setState({ workingEndDate: date })
                            }
                            date={
                                setStartDate ? workingStartDate : workingEndDate
                            }
                            maximumDate={new Date()}
                            textColor="#fff"
                            mode="date"
                        />
                        <View style={{ padding: 2 }}>
                            <Button
                                onPress={() => {
                                    if (setStartDate) {
                                        setStartDateFilter(workingStartDate);
                                    } else {
                                        setEndDateFilter(workingEndDate);
                                    }
                                    this.setState({
                                        setStartDate: false,
                                        setEndDate: false,
                                        workingStartDate: null,
                                        workingEndDate: null
                                    });
                                }}
                                buttonStyle={{ backgroundColor: 'orange' }}
                                title="Set"
                            />
                        </View>
                    </View>
                )}
            </>
        );

        const FILTERS = [
            {
                label: 'Lightning payments',
                value: lightning,
                var: 'lightning',
                type: 'Toggle'
            },
            {
                label: 'On-chain payments',
                value: onChain,
                var: 'onChain',
                type: 'Toggle'
            },
            {
                label: 'Channels',
                value: channels,
                var: 'channels',
                type: 'Toggle'
            },
            {
                label: 'Sent',
                value: sent,
                var: 'sent',
                type: 'Toggle'
            },
            {
                label: 'Received',
                value: received,
                var: 'received',
                type: 'Toggle'
            },
            {
                label: 'Date',
                value: received,
                var: 'received',
                type: 'Date'
            },
            // use this object for the date objects
            {
                label: '',
                type: 'DateData'
            }
        ];

        return (
            <View
                style={
                    theme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                <Header
                    leftComponent={<CloseButton />}
                    centerComponent={{
                        text: localeString('views.ActivityFilter.title'),
                        style: { color: '#fff' }
                    }}
                    backgroundColor="#1f2328"
                />
                <FlatList
                    data={FILTERS}
                    renderItem={({ item }) => (
                        <>
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor:
                                        theme === 'dark' ? '#1f2328' : 'white'
                                }}
                            >
                                <ListItem.Title
                                    style={{
                                        color:
                                            theme === 'dark'
                                                ? 'white'
                                                : '#1f2328'
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
                                            onValueChange={() => {
                                                let newFilters = filters;
                                                newFilters[item.var] = !filters[
                                                    item.var
                                                ];
                                                setFilters(newFilters);
                                            }}
                                            trackColor={{
                                                false: '#767577',
                                                true: '#ffd24b'
                                            }}
                                        />
                                    </View>
                                )}
                                {item.type === 'Date' && (
                                    <View style={{ flex: 1 }}>
                                        <DateFilter />
                                    </View>
                                )}
                                {item.type === 'DateData' && (
                                    <View style={{ flex: 1 }}>
                                        <DateData />
                                    </View>
                                )}
                            </ListItem>
                        </>
                    )}
                    keyExtractor={(item, index) => `${item.model}-${index}`}
                    ItemSeparatorComponent={this.renderSeparator}
                    onEndReachedThreshold={50}
                    refreshing={loading}
                />
            </View>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1,
        backgroundColor: 'white'
    },
    darkThemeStyle: {
        flex: 1,
        backgroundColor: '#1f2328',
        color: 'white'
    },
    lightSeparator: {
        height: 0.4,
        backgroundColor: '#CED0CE'
    },
    darkSeparator: {
        height: 0.4,
        backgroundColor: 'darkgray'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 10
    }
});
