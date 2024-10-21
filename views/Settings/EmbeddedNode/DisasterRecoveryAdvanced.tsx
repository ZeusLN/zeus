import * as React from 'react';
import { FlatList, Text, View } from 'react-native';
import { ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import moment from 'moment';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../../components/Button';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Screen from '../../../components/Screen';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';

import ChannelBackupStore from '../../../stores/ChannelBackupStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

interface DisasterRecoveryAdvancedProps {
    navigation: StackNavigationProp<any, any>;
    ChannelBackupStore: ChannelBackupStore;
}

interface DisasterRecoveryAdvancedState {
    selected: {
        backup?: string;
    };
}

@inject('ChannelBackupStore')
@observer
export default class DisasterRecoveryAdvanced extends React.Component<
    DisasterRecoveryAdvancedProps,
    DisasterRecoveryAdvancedState
> {
    state = {
        selected: { backup: '' }
    };

    UNSAFE_componentWillMount(): void {
        const { ChannelBackupStore } = this.props;
        ChannelBackupStore.reset();
        ChannelBackupStore.advancedRecoveryList();
    }

    render() {
        const { navigation, ChannelBackupStore } = this.props;
        const { selected } = this.state;
        const {
            advancedRecoveryList,
            triggerRecovery,
            backups,
            loading,
            error,
            error_msg
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
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <View style={{ flex: 1 }}>
                        {loading && <LoadingIndicator />}
                        {!loading && error && (
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
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
                                    fontFamily: 'PPNeueMontreal-Book',
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
                                            try {
                                                await triggerRecovery(
                                                    selected.backup
                                                );
                                                navigation.popTo('Wallet');
                                            } catch (e) {}
                                        }
                                    }}
                                />
                            </View>
                        )}
                        {!loading && error_msg && (
                            <ErrorMessage message={error_msg} />
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
                                        >
                                            <Text
                                                style={{
                                                    fontFamily:
                                                        'PPNeueMontreal-Medium',
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
                                                            'PPNeueMontreal-Book',
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
