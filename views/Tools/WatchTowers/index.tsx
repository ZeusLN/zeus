import * as React from 'react';
import {
    Text,
    View,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { SearchBar, Icon, Divider } from 'react-native-elements';

import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Screen from '../../../components/Screen';

import SettingsStore from '../../../stores/SettingsStore';
import BackendUtils from '../../../utils/BackendUtils';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import Base64Utils from '../../../utils/Base64Utils';

interface WatchtowersProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface WatchtowerSessionInfo {
    active_session_candidate: boolean;
    num_sessions: number;
    sessions: any[];
    policy_type: string;
}

interface Watchtower {
    pubkey: string;
    addresses: string[];
    active_session_candidate: boolean;
    num_sessions: number;
    sessions: any[];
    session_info: WatchtowerSessionInfo[];
}

interface WatchtowerListResponse {
    towers: Watchtower[];
}

interface WatchtowersState {
    loading: boolean;
    watchtowers: Watchtower[];
    searchQuery: string;
    refreshing: boolean;
    error: string;
}

@inject('SettingsStore')
@observer
export default class WatchTowers extends React.Component<
    WatchtowersProps,
    WatchtowersState
> {
    state = {
        loading: false,
        watchtowers: [] as Watchtower[],
        searchQuery: '',
        refreshing: false,
        error: ''
    };

    private focusListener: any;

    async componentDidMount() {
        await this.loadWatchtowers();
        this.focusListener = this.props.navigation.addListener('focus', () => {
            this.loadWatchtowers();
        });
    }

    componentWillUnmount() {
        if (this.focusListener) {
            this.focusListener();
        }
    }

    loadWatchtowers = async () => {
        this.setState({ loading: true, error: '' });

        try {
            const response: WatchtowerListResponse =
                await BackendUtils.listWatchtowers();
            this.setState({
                watchtowers: response.towers || [],
                loading: false
            });
        } catch (error: any) {
            let errorMessage = error.message || 'Failed to load watchtowers';
            if (
                errorMessage.includes('watchtower client not active') ||
                (error.code === 2 &&
                    errorMessage.includes('watchtower client not active'))
            ) {
                errorMessage = localeString(
                    'views.Tools.watchtowers.clientNotActive'
                );
            }
            this.setState({
                watchtowers: [],
                loading: false,
                error: errorMessage
            });
        }
    };

    onRefresh = async () => {
        this.setState({ refreshing: true });
        await this.loadWatchtowers();
        this.setState({ refreshing: false });
    };

    handleSearch = (text: string) => {
        this.setState({ searchQuery: text });
    };

    getFilteredWatchtowers = () => {
        const { watchtowers, searchQuery } = this.state;
        if (!searchQuery) return watchtowers;

        return watchtowers.filter((watchtower) => {
            const pubkeyMatch = watchtower.pubkey
                .toLowerCase()
                .includes(searchQuery.toLowerCase());

            const addressMatch = watchtower.addresses.some((address) =>
                address.toLowerCase().includes(searchQuery.toLowerCase())
            );

            return pubkeyMatch || addressMatch;
        });
    };

    renderItem = ({ item }: { item: Watchtower }) => (
        <>
            <TouchableOpacity
                style={styles.watchtowerItem}
                onPress={() =>
                    this.props.navigation.navigate('WatchTowerDetails', {
                        watchtower: item
                    })
                }
                disabled={this.state.loading}
            >
                <View style={styles.watchtowerContainer}>
                    <Icon
                        name="radio-tower"
                        type="octicon"
                        size={30}
                        color={
                            item.active_session_candidate
                                ? themeColor('highlight')
                                : themeColor('secondaryText')
                        }
                        containerStyle={styles.watchtowerIcon}
                    />
                    <View style={styles.watchtowerInfo}>
                        <Text
                            style={[
                                styles.watchtowerPubkey,
                                { color: themeColor('text') }
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="middle"
                        >
                            {Base64Utils.base64ToHex(item.pubkey)}
                        </Text>
                        {item.addresses && item.addresses.length > 0 && (
                            <Text
                                style={[
                                    styles.watchtowerAddress,
                                    { color: themeColor('secondaryText') }
                                ]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {item.addresses[0]}
                            </Text>
                        )}
                    </View>
                </View>

                <View style={styles.watchtowerControls}>
                    <Icon
                        name="chevron-right"
                        type="feather"
                        size={20}
                        color={themeColor('secondaryText')}
                    />
                </View>
            </TouchableOpacity>
        </>
    );

    renderEmptyState = () => {
        const { searchQuery, error } = this.state;

        return (
            <View style={styles.emptyContainer}>
                <Icon
                    name="radio-tower"
                    type="octicon"
                    size={50}
                    color={
                        error
                            ? themeColor('error')
                            : themeColor('secondaryText')
                    }
                    containerStyle={styles.emptyIcon}
                />
                <Text
                    style={[
                        styles.emptyText,
                        {
                            color: error
                                ? themeColor('error')
                                : themeColor('secondaryText')
                        }
                    ]}
                >
                    {error
                        ? error
                        : searchQuery.length > 0
                        ? localeString('views.Settings.Contacts.noAddress')
                        : localeString('views.Tools.watchtowers.noWatchtowers')}
                </Text>
            </View>
        );
    };

    render() {
        const { navigation } = this.props;
        const { loading, searchQuery, refreshing, error } = this.state;
        const filteredWatchtowers = this.getFilteredWatchtowers();

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Tools.watchtowers'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        loading ? (
                            <LoadingIndicator size={30} />
                        ) : !error ? (
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('AddWatchtower')
                                }
                            >
                                <Icon
                                    name="plus"
                                    type="feather"
                                    size={40}
                                    color={themeColor('text')}
                                />
                            </TouchableOpacity>
                        ) : undefined
                    }
                    navigation={navigation}
                />
                <View style={styles.container}>
                    {!error && (
                        <SearchBar
                            placeholder={localeString('general.search')}
                            // @ts-ignore:next-line
                            onChangeText={this.handleSearch}
                            value={searchQuery}
                            inputStyle={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                            placeholderTextColor={themeColor('secondaryText')}
                            containerStyle={{
                                backgroundColor: 'transparent',
                                borderTopWidth: 0,
                                borderBottomWidth: 0,
                                paddingHorizontal: 0,
                                marginBottom: 10
                            }}
                            inputContainerStyle={{
                                borderRadius: 15,
                                backgroundColor: themeColor('secondary')
                            }}
                            // @ts-ignore:next-line
                            searchIcon={{
                                importantForAccessibility:
                                    'no-hide-descendants',
                                accessibilityElementsHidden: true
                            }}
                        />
                    )}

                    {filteredWatchtowers.length > 0 && !this.state.error ? (
                        <FlatList
                            data={filteredWatchtowers}
                            renderItem={this.renderItem}
                            keyExtractor={(item) => item.pubkey}
                            contentContainerStyle={styles.listContainer}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={this.onRefresh}
                                    tintColor={themeColor('text')}
                                    colors={[themeColor('highlight')]}
                                />
                            }
                            ItemSeparatorComponent={() => (
                                <Divider
                                    style={[
                                        styles.divider,
                                        {
                                            backgroundColor:
                                                themeColor('border')
                                        }
                                    ]}
                                />
                            )}
                        />
                    ) : (
                        this.renderEmptyState()
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 15
    },
    listContainer: {
        paddingBottom: 15
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    emptyIcon: {
        marginBottom: 16,
        opacity: 0.6
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center'
    },
    watchtowerItem: {
        flexDirection: 'row',
        padding: 16,
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    watchtowerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    watchtowerIcon: {
        marginRight: 8
    },
    watchtowerInfo: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center'
    },
    watchtowerPubkey: {
        fontSize: 16,
        fontWeight: '500'
    },
    watchtowerAddress: {
        fontSize: 14
    },
    watchtowerSessions: {
        fontSize: 12,
        marginTop: 4
    },
    watchtowerControls: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    deleteButton: {
        marginLeft: 15,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center'
    },
    divider: {
        marginHorizontal: 16
    }
});
