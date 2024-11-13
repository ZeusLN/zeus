import * as React from 'react';
import { FlatList, Platform, Text, View, StyleSheet } from 'react-native';
import { Button, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Amount from '../components/Amount';
import Header from '../components/Header';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import Switch from '../components/Switch';

import { localeString } from '../utils/LocaleUtils';
import { restartNeeded } from '../utils/RestartUtils';
import { themeColor } from '../utils/ThemeUtils';
import { numberWithCommas } from '../utils/UnitsUtils';

import ChannelsStore from '../stores/ChannelsStore';
import SettingsStore from '../stores/SettingsStore';

interface PendingHTLCsProps {
    navigation: StackNavigationProp<any, any>;
    ChannelsStore: ChannelsStore;
    SettingsStore: SettingsStore;
    route: Route<'PendingHTLCs', { pending_htlcs: any }>;
}

interface PendingHTLCsState {
    persistentMode: boolean;
    pendingHTLCs: any;
}

const PERSISTENT_KEY = 'persistentServicesEnabled';

@inject('ChannelsStore', 'SettingsStore')
@observer
export default class PendingHTLCs extends React.PureComponent<
    PendingHTLCsProps,
    PendingHTLCsState
> {
    state = {
        persistentMode: false,
        pendingHTLCs: []
    };

    async UNSAFE_componentWillMount() {
        const persistentMode = await AsyncStorage.getItem(PERSISTENT_KEY);
        const pending_htlcs = this.props.route.params?.pending_htlcs;

        this.setState({
            persistentMode: persistentMode === 'true' ? true : false,
            pendingHTLCs: pending_htlcs || this.props.ChannelsStore.pendingHTLCs
        });
    }

    renderSeparator = () => (
        <View
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    getRightTitleTheme = (item: any) => {
        if (item.incoming) return 'success';
        return 'warning';
    };

    render() {
        const { navigation, ChannelsStore, SettingsStore } = this.props;
        const { pendingHTLCs, persistentMode } = this.state;
        const { getChannels, loading } = ChannelsStore;
        const { updateSettings, implementation } = SettingsStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.PendingHTLCs.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                {loading ? (
                    <View style={{ padding: 50 }}>
                        <LoadingIndicator />
                    </View>
                ) : !!pendingHTLCs && pendingHTLCs.length > 0 ? (
                    <FlatList
                        data={pendingHTLCs}
                        renderItem={({ item }: { item: any }) => {
                            const displayName = item.incoming
                                ? localeString('views.PendingHTLCs.incoming')
                                : localeString('views.PendingHTLCs.outgoing');
                            const subTitle = `${localeString(
                                'views.PendingHTLCs.expirationHeight'
                            )}: ${numberWithCommas(item.expiration_height)}`;

                            return (
                                <React.Fragment>
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: 'transparent'
                                        }}
                                        // TODO add individual HTLC view
                                        // onPress={() => {
                                        //     navigation.navigate('PendingHTLC', {
                                        //         pendingHTLC: item
                                        //     });
                                        // }}
                                    >
                                        <ListItem.Content>
                                            <View style={styles.row}>
                                                <ListItem.Title
                                                    style={{
                                                        ...styles.leftCell,
                                                        fontWeight: '600',
                                                        color: themeColor(
                                                            'text'
                                                        ),
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    {displayName}
                                                </ListItem.Title>

                                                <View
                                                    style={{
                                                        ...styles.rightCell,
                                                        flexDirection: 'row',
                                                        flexWrap: 'wrap',
                                                        columnGap: 5,
                                                        rowGap: -5,
                                                        justifyContent:
                                                            'flex-end'
                                                    }}
                                                >
                                                    <Amount
                                                        sats={item.amount}
                                                        sensitive
                                                        color={this.getRightTitleTheme(
                                                            item
                                                        )}
                                                    />
                                                    {!!item.getFee &&
                                                        item.getFee != 0 && (
                                                            <>
                                                                <Text
                                                                    style={{
                                                                        color: themeColor(
                                                                            'text'
                                                                        ),
                                                                        fontSize: 16
                                                                    }}
                                                                >
                                                                    +
                                                                </Text>
                                                                <Amount
                                                                    sats={
                                                                        item.getFee
                                                                    }
                                                                    sensitive
                                                                    color={this.getRightTitleTheme(
                                                                        item
                                                                    )}
                                                                    fee
                                                                />
                                                            </>
                                                        )}
                                                </View>
                                            </View>

                                            <View style={styles.row}>
                                                <ListItem.Subtitle
                                                    right
                                                    style={{
                                                        ...styles.leftCell,
                                                        color: themeColor(
                                                            'secondaryText'
                                                        ),
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    {subTitle}
                                                </ListItem.Subtitle>

                                                <ListItem.Subtitle
                                                    style={{
                                                        ...styles.rightCell,
                                                        color: themeColor(
                                                            'secondaryText'
                                                        ),
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    {item.channelDisplayName}
                                                </ListItem.Subtitle>
                                            </View>
                                        </ListItem.Content>
                                    </ListItem>
                                </React.Fragment>
                            );
                        }}
                        keyExtractor={(item, index) =>
                            `${item.hash_lock}-${index}`
                        }
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                        refreshing={loading}
                        onRefresh={() => getChannels()}
                        initialNumToRender={10}
                        maxToRenderPerBatch={5}
                        windowSize={10}
                    />
                ) : (
                    <Button
                        title={localeString('views.PendingHTLCs.noPendingHTLC')}
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: themeColor('text')
                        }}
                        onPress={() => getChannels()}
                        buttonStyle={{
                            backgroundColor: 'transparent',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    />
                )}
                {implementation === 'embedded-lnd' &&
                    !loading &&
                    !!pendingHTLCs &&
                    pendingHTLCs.length > 0 && (
                        <View
                            style={{ backgroundColor: themeColor('highlight') }}
                        >
                            {Platform.OS === 'ios' && (
                                <>
                                    <View
                                        style={{ marginBottom: 25, margin: 15 }}
                                    >
                                        <Text
                                            style={{
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                color: themeColor('background')
                                            }}
                                        >
                                            {localeString(
                                                'views.PendingHTLCs.recommendationIOS'
                                            )}
                                        </Text>
                                    </View>
                                </>
                            )}
                            {Platform.OS === 'android' && (
                                <>
                                    <View
                                        style={{ marginBottom: 0, margin: 15 }}
                                    >
                                        <Text
                                            style={{
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                color: themeColor('background')
                                            }}
                                        >
                                            {localeString(
                                                'views.PendingHTLCs.recommendationAndroid'
                                            )}
                                        </Text>
                                    </View>
                                    <View
                                        style={{ marginBottom: 25, margin: 15 }}
                                    >
                                        <ListItem
                                            containerStyle={{
                                                borderBottomWidth: 0,
                                                backgroundColor: 'transparent'
                                            }}
                                        >
                                            <ListItem.Title
                                                style={{
                                                    color: themeColor(
                                                        'background'
                                                    ),
                                                    fontFamily:
                                                        'PPNeueMontreal-Book'
                                                }}
                                            >
                                                {localeString(
                                                    'views.Settings.EmbeddedNode.persistentMode'
                                                )}
                                            </ListItem.Title>
                                            <View
                                                style={{
                                                    flex: 1,
                                                    flexDirection: 'row',
                                                    justifyContent: 'flex-end'
                                                }}
                                            >
                                                <Switch
                                                    value={persistentMode}
                                                    onValueChange={async () => {
                                                        this.setState({
                                                            persistentMode:
                                                                !persistentMode
                                                        });
                                                        await updateSettings({
                                                            persistentMode:
                                                                !persistentMode
                                                        });
                                                        const newValue =
                                                            !persistentMode;
                                                        await AsyncStorage.setItem(
                                                            PERSISTENT_KEY,
                                                            newValue.toString()
                                                        );
                                                        restartNeeded();
                                                    }}
                                                    trackEnabledColor={themeColor(
                                                        'background'
                                                    )}
                                                />
                                            </View>
                                        </ListItem>
                                    </View>
                                </>
                            )}
                        </View>
                    )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        columnGap: 10
    },
    leftCell: {
        flexGrow: 0,
        flexShrink: 1
    },
    rightCell: {
        flexGrow: 0,
        flexShrink: 1,
        textAlign: 'right'
    }
});
