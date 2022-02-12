import * as React from 'react';
import { FlatList, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import DatePicker from 'react-native-date-picker';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import ActivityStore from './../../stores/ActivityStore';

interface ActivityFilterProps {
    navigation: any;
    ActivityStore: ActivityStore;
}

interface ActivityFilterState {
    setStartDate: boolean;
    setEndDate: boolean;
    workingStartDate: any;
    workingEndDate: any;
}

@inject('ActivityStore')
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
        const { navigation, ActivityStore } = this.props;
        const { setStartDate, setEndDate, workingStartDate, workingEndDate } =
            this.state;
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

        const CloseButton = () => (
            <Icon
                name="close"
                onPress={() =>
                    navigation.navigate('Activity', { refresh: true })
                }
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
                        titleStyle={{
                            color: 'black',
                            fontFamily: 'Lato-Regular'
                        }}
                        title={
                            startDate
                                ? localeString(
                                      'views.ActivityFilter.clearStartDate'
                                  )
                                : localeString(
                                      'views.ActivityFilter.setStartDate'
                                  )
                        }
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
                        titleStyle={{
                            color: 'white',
                            fontFamily: 'Lato-Regular'
                        }}
                        title={
                            endDate
                                ? localeString(
                                      'views.ActivityFilter.clearEndDate'
                                  )
                                : localeString(
                                      'views.ActivityFilter.setEndDate'
                                  )
                        }
                    />
                </View>
            </View>
        );

        const DateData = () => (
            <>
                <>
                    {startDate && (
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('text')
                            }}
                        >{`${localeString(
                            'views.ActivityFilter.startDate'
                        )}: ${startDate.toString()}`}</Text>
                    )}
                    {endDate && (
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('text')
                            }}
                        >{`${localeString(
                            'views.ActivityFilter.endDate'
                        )}: ${endDate.toString()}`}</Text>
                    )}
                </>
                {(setStartDate || setEndDate) && (
                    <View
                        style={{
                            marginTop: 20
                        }}
                    >
                        <DatePicker
                            onDateChange={(date) =>
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
                                        workingStartDate: new Date(),
                                        workingEndDate: new Date()
                                    });
                                }}
                                buttonStyle={{ backgroundColor: 'orange' }}
                                title={
                                    setStartDate
                                        ? localeString(
                                              'views.ActivityFilter.setStartDate'
                                          )
                                        : localeString(
                                              'views.ActivityFilter.setEndDate'
                                          )
                                }
                            />
                        </View>
                    </View>
                )}
            </>
        );

        const FILTERS = [
            {
                label: localeString('views.ActivityFilter.lightningPayments'),
                value: lightning,
                var: 'lightning',
                type: 'Toggle'
            },
            {
                label: localeString('views.ActivityFilter.onChainPayments'),
                value: onChain,
                var: 'onChain',
                type: 'Toggle'
            },
            {
                label: localeString('views.Wallet.Wallet.channels'),
                value: channels,
                var: 'channels',
                type: 'Toggle'
            },
            {
                label: localeString('general.sent'),
                value: sent,
                var: 'sent',
                type: 'Toggle'
            },
            {
                label: localeString('general.received'),
                value: received,
                var: 'received',
                type: 'Toggle'
            },
            {
                label: localeString('general.date'),
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
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background'),
                    color: themeColor('text')
                }}
            >
                <Header
                    leftComponent={<CloseButton />}
                    centerComponent={{
                        text: localeString('views.ActivityFilter.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <FlatList
                    data={FILTERS}
                    renderItem={({ item }) => (
                        <>
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: themeColor('background')
                                }}
                            >
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'Lato-Regular'
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
                                                const newFilters: any = filters;
                                                const index = `${item.var}`;
                                                newFilters[index] =
                                                    !filters[index];
                                                setFilters(newFilters);
                                            }}
                                            trackColor={{
                                                false: '#767577',
                                                true: themeColor('highlight')
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
                    keyExtractor={(item: any, index: any) =>
                        `${item.model}-${index}`
                    }
                    ItemSeparatorComponent={this.renderSeparator}
                    onEndReachedThreshold={50}
                    refreshing={loading}
                />
            </View>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        paddingTop: 30,
        fontFamily: 'Lato-Regular'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 10
    }
});
