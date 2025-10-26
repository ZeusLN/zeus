import * as React from 'react';
import {
    Text,
    View,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl
} from 'react-native';
import { observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { SearchBar, Icon, Divider } from '@rneui/themed';

import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Screen from '../../../components/Screen';

import BackendUtils from '../../../utils/BackendUtils';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import Base64Utils from '../../../utils/Base64Utils';

import Add from '../../../assets/images/SVG/Add.svg';
interface WatchtowersProps {
    navigation: StackNavigationProp<any, any>;
}

export interface Watchtower {
    pubkey: string;
    addresses: string[];
    active_session_candidate: boolean;
    num_sessions: number;
    session_info?: any[];
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

@observer
export default class Watchtowers extends React.Component<
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
            const pubkeyHex = Base64Utils.base64ToHex(watchtower.pubkey);
            const pubkeyMatch = pubkeyHex
                .toLowerCase()
                .includes(searchQuery.toLowerCase());

            const addressMatch =
                watchtower.addresses?.some((address) =>
                    address.toLowerCase().includes(searchQuery.toLowerCase())
                ) || false;

            return pubkeyMatch || addressMatch;
        });
    };

    renderItem = ({ item }: { item: Watchtower }) => (
        <>
            <TouchableOpacity
                style={styles.watchtowerItem}
                onPress={() => {
                    const serializaeWatchtower = {
                        pubkey: item.pubkey,
                        addresses: item.addresses,
                        active_session_candidate: item.active_session_candidate,
                        num_sessions: item.num_sessions
                    };
                    this.props.navigation.navigate('WatchtowerDetails', {
                        watchtower: serializaeWatchtower
                    });
                }}
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
            </TouchableOpacity>
        </>
    );

    renderEmptyState = () => {
        const { searchQuery } = this.state;

        return (
            <View style={styles.emptyContainer}>
                <Icon
                    name="radio-tower"
                    type="octicon"
                    size={50}
                    color={themeColor('secondaryText')}
                    containerStyle={styles.emptyIcon}
                />
                <Text
                    style={[
                        styles.emptyText,
                        {
                            color: themeColor('secondaryText')
                        }
                    ]}
                >
                    {searchQuery.length > 0
                        ? localeString(
                              'views.Tools.watchtowers.noWatchtowersSearch'
                          )
                        : localeString('views.Tools.watchtowers.noWatchtowers')}
                </Text>
            </View>
        );
    };

    render() {
        const { navigation } = this.props;
        const { loading, searchQuery, refreshing, error, watchtowers } =
            this.state;
        const filteredWatchtowers = this.getFilteredWatchtowers();
        const AddButton = () => (
            <TouchableOpacity
                onPress={() => navigation.navigate('AddWatchtower')}
                accessibilityLabel={localeString('general.add')}
            >
                <Add
                    fill={themeColor('text')}
                    width="30"
                    height="30"
                    style={{
                        alignSelf: 'center',
                        marginLeft: 8
                    }}
                />
            </TouchableOpacity>
        );

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
                            <View style={{ marginRight: 8 }}>
                                <LoadingIndicator size={24} />
                            </View>
                        ) : !error ? (
                            <AddButton />
                        ) : undefined
                    }
                    navigation={navigation}
                />
                <View style={styles.container}>
                    {error ? (
                        <View style={styles.emptyContainer}>
                            <Icon
                                name="radio-tower"
                                type="octicon"
                                size={50}
                                color={themeColor('error')}
                                containerStyle={styles.emptyIcon}
                            />
                            <Text
                                style={[
                                    styles.emptyText,
                                    {
                                        color: themeColor('error')
                                    }
                                ]}
                            >
                                {error}
                            </Text>
                        </View>
                    ) : watchtowers.length === 0 ? (
                        this.renderEmptyState()
                    ) : (
                        <>
                            <SearchBar
                                placeholder={localeString('general.search')}
                                // @ts-ignore:next-line
                                onChangeText={this.handleSearch}
                                value={searchQuery}
                                inputStyle={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
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

                            {filteredWatchtowers.length > 0 ? (
                                <FlatList
                                    data={filteredWatchtowers}
                                    renderItem={this.renderItem}
                                    keyExtractor={(item) => item.pubkey}
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
                        </>
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        padding: 10,
        flex: 1
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 300
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
        paddingVertical: 16,
        paddingHorizontal: 5,
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    watchtowerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        height: '100%',
        gap: 4
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
    divider: {
        marginHorizontal: 1
    }
});
