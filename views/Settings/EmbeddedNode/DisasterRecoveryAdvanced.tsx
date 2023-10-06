import * as React from 'react';
import { FlatList, Text, View } from 'react-native';
import { ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import moment from 'moment';

import Button from '../../../components/Button';
import Screen from '../../../components/Screen';
import Header from '../../../components/Header';

import ChannelBackupStore from '../../../stores/ChannelBackupStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import LoadingIndicator from '../../../components/LoadingIndicator';

interface DisasterRecoveryAdvancedProps {
    navigation: any;
    ChannelBackupStore: ChannelBackupStore;
}

interface DisasterRecoveryAdvancedState {
    selected: any;
}

@inject('ChannelBackupStore')
@observer
export default class DisasterRecoveryAdvanced extends React.Component<
    DisasterRecoveryAdvancedProps,
    DisasterRecoveryAdvancedState
> {
    state = {
        selected: {}
    };

    UNSAFE_componentWillMount(): void {
        this.props.ChannelBackupStore.advancedRecoveryList();
    }

    render() {
        const { navigation, ChannelBackupStore } = this.props;
        const { selected } = this.state;
        const {
            advancedRecoveryList,
            triggerRecovery,
            backups,
            loading,
            error
        } = ChannelBackupStore;

        const noneSelected = Object.keys(selected).length === 0;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.AdvancedDisasterRecovery.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        navigation={navigation}
                    />
                    <View style={{ flex: 1 }}>
                        {loading && <LoadingIndicator />}
                        {!loading && error && (
                            <Text
                                style={{
                                    fontFamily: 'Lato-Regular',
                                    textAlign: 'center',
                                    color: themeColor('error')
                                }}
                            >
                                {localeString(
                                    'views.Settings.EmbeddedNode.AdvancedDisasterRecovery.fetchFailure'
                                )}
                            </Text>
                        )}
                        {!loading && backups.length === 0 && (
                            <Text
                                style={{
                                    fontFamily: 'Lato-Regular',
                                    textAlign: 'center',
                                    color: themeColor('text')
                                }}
                            >
                                {localeString(
                                    'views.Settings.EmbeddedNode.AdvancedDisasterRecovery.noBackups'
                                )}
                            </Text>
                        )}
                        {!loading && backups.length > 0 && (
                            <View style={{ marginTop: 10, marginBottom: 10 }}>
                                <Button
                                    title={
                                        noneSelected
                                            ? localeString(
                                                  'views.Settings.EmbeddedNode.AdvancedDisasterRecovery.select'
                                              )
                                            : localeString(
                                                  'views.Settings.EmbeddedNode.AdvancedDisasterRecovery.startRecovery'
                                              )
                                    }
                                    disabled={noneSelected}
                                    onPress={async () => {
                                        if (selected.backup) {
                                            await triggerRecovery(
                                                selected.backup
                                            );
                                            navigation.navigate('Wallet');
                                        }
                                    }}
                                />
                            </View>
                        )}
                        {!loading && backups.length > 0 && (
                            <FlatList
                                data={backups}
                                renderItem={({ item }: any) => {
                                    const isSelected = item === selected;
                                    return (
                                        <ListItem
                                            containerStyle={{
                                                flex: 1,
                                                flexDirection: 'column',
                                                borderBottomWidth: 0,
                                                backgroundColor: 'transparent'
                                            }}
                                            onPress={() =>
                                                this.setState({
                                                    selected: item
                                                })
                                            }
                                            hasTVPreferredFocus={false}
                                            tvParallaxProperties={{}}
                                        >
                                            <Text
                                                style={{
                                                    fontFamily: 'Lato-Bold',
                                                    alignSelf: 'flex-start',
                                                    color: isSelected
                                                        ? themeColor(
                                                              'highlight'
                                                          )
                                                        : themeColor('text')
                                                }}
                                            >
                                                {item.id}
                                            </Text>
                                            <View
                                                style={{
                                                    alignSelf: 'flex-start'
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        fontFamily:
                                                            'Lato-Regular',
                                                        alignSelf: 'flex-start',
                                                        color: isSelected
                                                            ? themeColor(
                                                                  'highlight'
                                                              )
                                                            : themeColor('text')
                                                    }}
                                                >
                                                    {moment(
                                                        item.created_at
                                                    ).format(
                                                        'ddd, MMM DD, hh:mm:ss a'
                                                    )}
                                                </Text>
                                            </View>
                                        </ListItem>
                                    );
                                }}
                                keyExtractor={(item: any, index: number) =>
                                    `${item.id}-${index}`
                                }
                                onEndReachedThreshold={50}
                                refreshing={loading}
                                onRefresh={() => advancedRecoveryList()}
                            />
                        )}
                    </View>
                </View>
            </Screen>
        );
    }
}
