import * as React from 'react';
import {
    Text,
    View,
    TouchableOpacity,
    FlatList,
    Image,
    ScrollView
} from 'react-native';
import { SearchBar, Divider } from 'react-native-elements';
import AddIcon from '../../assets/images/SVG/Add.svg';
import EncryptedStorage from 'react-native-encrypted-storage';

import { themeColor } from '../../utils/ThemeUtils';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import LoadingIndicator from '../../components/LoadingIndicator';
import Header from '../../components/Header';
import { localeString } from '../../utils/LocaleUtils';

interface ContactsSettingsProps {
    navigation: any;
}

interface ContactItem {
    lnAddress: string;
    onchainAddress: string;
    pubkey: string;
    nip05: string;
    nostrNpub: string;
    name: string;
    description: string;
    photo: string | null;
    isFavourite: boolean;
    id: string;
}

interface ContactsSettingsState {
    contacts: ContactItem[];
    search: string;
    SendScreen: boolean;
    loading: boolean;
}

export default class Contacts extends React.Component<
    ContactsSettingsProps,
    ContactsSettingsState
> {
    constructor(props: ContactsSettingsProps) {
        super(props);
        const SendScreen: boolean = this.props.navigation.getParam(
            'SendScreen',
            null
        );
        this.state = {
            contacts: [],
            search: '',
            SendScreen,
            loading: true
        };
    }

    componentDidMount() {
        this.loadContacts();
    }

    loadContacts = async () => {
        this.props.navigation.addListener('didFocus', async () => {
            try {
                const contactsString = await EncryptedStorage.getItem(
                    'zeus-contacts'
                );
                if (contactsString) {
                    const contacts: ContactItem[] = JSON.parse(contactsString);
                    this.setState({ contacts, loading: false });
                } else {
                    this.setState({ loading: false });
                }
            } catch (error) {
                console.log('Error loading contacts:', error);
                this.setState({ loading: false });
            }
        });
    };
    displayAddress = (item) => {
        const hasLnAddress =
            item.lnAddress &&
            item.lnAddress.length === 1 &&
            item.lnAddress[0] !== '';
        const hasOnchainAddress =
            item.onchainAddress &&
            item.onchainAddress.length === 1 &&
            item.onchainAddress[0] !== '';
        const hasPubkey =
            item.pubkey && item.pubkey.length === 1 && item.pubkey[0] !== '';

        if (hasLnAddress + hasOnchainAddress + hasPubkey >= 2) {
            return localeString('views.Settings.Contacts.multipleAddresses');
        }

        if (hasLnAddress) {
            return item.lnAddress[0].length > 23
                ? `${item.lnAddress[0].slice(
                      0,
                      10
                  )}...${item.lnAddress[0].slice(-10)}`
                : item.lnAddress[0];
        }

        if (hasOnchainAddress) {
            return item.onchainAddress[0].length > 23
                ? `${item.onchainAddress[0].slice(
                      0,
                      12
                  )}...${item.onchainAddress[0].slice(-8)}`
                : item.onchainAddress[0];
        }

        if (hasPubkey) {
            return item.pubkey[0].length > 23
                ? `${item.pubkey[0].slice(0, 12)}...${item.pubkey[0].slice(-8)}`
                : item.pubkey[0];
        }

        return localeString('views.Settings.Contacts.multipleAddresses');
    };

    renderContactItem = ({ item }: { item: ContactItem }) => (
        <TouchableOpacity
            onPress={() => {
                (item.lnAddress &&
                    item.lnAddress.length === 1 &&
                    item.lnAddress[0] !== '' &&
                    item.onchainAddress[0] === '' &&
                    item.pubkey[0] === '' &&
                    this.state.SendScreen &&
                    this.props.navigation.navigate('Send', {
                        destination: item.lnAddress[0],
                        contactName: item.name
                    })) ||
                    (item.onchainAddress &&
                        item.onchainAddress.length === 1 &&
                        item.onchainAddress[0] !== '' &&
                        item.lnAddress[0] === '' &&
                        item.pubkey[0] === '' &&
                        this.state.SendScreen &&
                        this.props.navigation.navigate('Send', {
                            destination: item.onchainAddress[0],
                            contactName: item.name
                        })) ||
                    (item.pubkey &&
                        item.pubkey.length === 1 &&
                        item.pubkey[0] !== '' &&
                        item.lnAddress[0] === '' &&
                        item.onchainAddress[0] === '' &&
                        this.state.SendScreen &&
                        this.props.navigation.navigate('Send', {
                            destination: item.pubkey[0],
                            contactName: item.name
                        })) ||
                    this.props.navigation.navigate('ContactDetails', {
                        contactId: item.id
                    });
            }}
        >
            <View
                style={{
                    marginHorizontal: 24,
                    paddingBottom: 20,
                    flexDirection: 'row',
                    alignItems: 'center'
                }}
            >
                {item.photo && (
                    <Image
                        source={{ uri: item.photo }}
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            marginRight: 10
                        }}
                    />
                )}
                <View>
                    <Text style={{ fontSize: 16, color: themeColor('text') }}>
                        {item.name}
                    </Text>
                    <Text
                        style={{
                            fontSize: 16,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {this.displayAddress(item)}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    updateSearch = (query: string) => {
        this.setState({ search: query });
    };

    render() {
        const { navigation } = this.props;
        const { search, contacts, SendScreen, loading } = this.state;
        const filteredContacts = contacts.filter((contact) => {
            const hasMatch = (field: string) =>
                Array.isArray(contact[field])
                    ? contact[field].some((input) =>
                          input.toLowerCase().includes(search.toLowerCase())
                      )
                    : contact[field]
                          .toLowerCase()
                          .includes(search.toLowerCase());

            return (
                hasMatch('name') ||
                hasMatch('description') ||
                hasMatch('lnAddress') ||
                hasMatch('nip05') ||
                hasMatch('onchainAddress') ||
                hasMatch('nostrNpub') ||
                hasMatch('pubkey')
            );
        });

        const Add = ({ navigation }: { navigation: any }) => (
            <TouchableOpacity onPress={() => navigation.navigate('AddContact')}>
                <View
                    style={{
                        width: 35,
                        height: 35,
                        borderRadius: 25,
                        backgroundColor: themeColor('chain'),
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    <AddIcon
                        fill={themeColor('background')}
                        width={20}
                        height={20}
                        style={{ alignSelf: 'center' }}
                    />
                </View>
            </TouchableOpacity>
        );

        const favoriteContacts = filteredContacts.filter(
            (contact) => contact.isFavourite
        );
        const nonFavoriteContacts = filteredContacts.filter(
            (contact) => !contact.isFavourite
        );

        return (
            <Screen
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent="Back"
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                    rightComponent={
                        !SendScreen && <Add navigation={navigation} />
                    }
                    navigation={navigation}
                />
                {contacts.length > 0 && (
                    <>
                        {SendScreen ? (
                            <View>
                                <Divider
                                    orientation="horizontal"
                                    style={{ marginTop: 14 }}
                                />
                                <SearchBar
                                    placeholder={localeString(
                                        'views.Settings.Contacts.searchBar1'
                                    )}
                                    onChangeText={this.updateSearch}
                                    value={this.state.search}
                                    inputStyle={{
                                        color: themeColor('text')
                                    }}
                                    placeholderTextColor={themeColor(
                                        'secondaryText'
                                    )}
                                    containerStyle={{
                                        backgroundColor: 'none',
                                        borderTopWidth: 0,
                                        borderBottomWidth: 0
                                    }}
                                    inputContainerStyle={{
                                        backgroundColor: 'none'
                                    }}
                                    searchIcon={
                                        <Text
                                            style={{
                                                fontSize: 20,
                                                color: themeColor('text'),
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            To
                                        </Text>
                                    }
                                    leftIconContainerStyle={{
                                        marginLeft: 18,
                                        marginRight: -8
                                    }}
                                />
                                <Divider orientation="horizontal" />
                            </View>
                        ) : (
                            <SearchBar
                                placeholder={localeString(
                                    'views.Settings.Contacts.searchBar2'
                                )}
                                onChangeText={this.updateSearch}
                                value={this.state.search}
                                inputStyle={{
                                    color: themeColor('text')
                                }}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
                                containerStyle={{
                                    backgroundColor: 'transparent',
                                    borderTopWidth: 0,
                                    borderBottomWidth: 0
                                }}
                                inputContainerStyle={{
                                    borderRadius: 15,
                                    backgroundColor: themeColor('secondary')
                                }}
                            />
                        )}
                    </>
                )}
                <ScrollView>
                    {/* Render favorite contacts */}
                    {favoriteContacts.length > 0 && (
                        <View style={{ margin: 28 }}>
                            <Text
                                style={{
                                    fontSize: 16,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {`${localeString(
                                    'views.Settings.Contacts.favorites'
                                ).toUpperCase()} (${favoriteContacts.length})`}
                            </Text>
                        </View>
                    )}
                    <FlatList
                        data={favoriteContacts}
                        renderItem={this.renderContactItem}
                        keyExtractor={(item, index) => index.toString()}
                    />

                    {/* Render non-favorite contacts */}
                    {nonFavoriteContacts.length > 0 && (
                        <View
                            style={{
                                margin: 28,
                                marginTop:
                                    favoriteContacts.length === 0 ? 28 : 10
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 16,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {`${localeString(
                                    'views.Settings.Contacts.contacts'
                                ).toUpperCase()} (${
                                    nonFavoriteContacts.length
                                })`}
                            </Text>
                        </View>
                    )}
                    <FlatList
                        data={nonFavoriteContacts}
                        renderItem={this.renderContactItem}
                        keyExtractor={(item, index) => index.toString()}
                    />
                    {loading ? (
                        <LoadingIndicator />
                    ) : (
                        contacts.length === 0 && (
                            <Button
                                title={localeString(
                                    'views.Settings.Contacts.noContacts'
                                )}
                                icon={{
                                    name: 'error-outline',
                                    size: 25,
                                    color: themeColor('text')
                                }}
                                buttonStyle={{
                                    backgroundColor: 'transparent',
                                    borderRadius: 30
                                }}
                                titleStyle={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            />
                        )
                    )}
                </ScrollView>
            </Screen>
        );
    }
}
