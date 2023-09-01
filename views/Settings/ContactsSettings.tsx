import * as React from 'react';
import { Text, View, TouchableOpacity, FlatList, Image } from 'react-native';
import { Header, Icon, SearchBar, Chip, Divider } from 'react-native-elements';
import AddIcon from '../../assets/images/SVG/Add.svg';
import EncryptedStorage from 'react-native-encrypted-storage';

import { themeColor } from '../../utils/ThemeUtils';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import LoadingIndicator from '../../components/LoadingIndicator';
import { localeString } from '../../utils/LocaleUtils';

interface ContactsSettingsProps {
    navigation: any;
}

interface ContactItem {
    lnAddress: string;
    onchainAddress: string;
    nip05: string;
    nostrNpub: string;
    name: string;
    description: string;
    photo: string | null;
    isFavourite: boolean;
}

interface ContactsSettingsState {
    contacts: ContactItem[];
    search: string;
    SendScreen: boolean;
    loading: boolean;
}

export default class ContactsSettings extends React.Component<
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

    renderContactItem = ({ item }: { item: ContactItem }) => (
        <TouchableOpacity
            onPress={() =>
                this.props.navigation.navigate('ContactDetails', {
                    contact: item
                })
            }
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
                        {item.lnAddress &&
                        item.lnAddress.length === 1 &&
                        item.lnAddress[0] !== '' &&
                        item.onchainAddress[0] === ''
                            ? item.lnAddress[0].length > 15
                                ? `${item.lnAddress[0].slice(
                                      0,
                                      4
                                  )}...${item.lnAddress[0].slice(-4)}`
                                : item.lnAddress[0]
                            : item.lnAddress.length > 1
                            ? `${localeString(
                                  'views.Settings.ContactsSettings.multipleAddresses'
                              )}`
                            : item.onchainAddress &&
                              item.onchainAddress.length === 1 &&
                              item.onchainAddress[0] !== '' &&
                              item.lnAddress[0] === ''
                            ? item.onchainAddress[0].length > 15
                                ? `${item.onchainAddress[0].slice(
                                      0,
                                      4
                                  )}...${item.onchainAddress[0].slice(-4)}`
                                : item.onchainAddress[0]
                            : `${localeString(
                                  'views.Settings.ContactsSettings.multipleAddresses'
                              )}`}
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
                    ? contact[field].some((input) => input.includes(search))
                    : contact[field].includes(search);

            return (
                hasMatch('name') ||
                hasMatch('description') ||
                hasMatch('lnAddress') ||
                hasMatch('nip05') ||
                hasMatch('onchainAddress') ||
                hasMatch('nostrNpub')
            );
        });

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => {
                    navigation.goBack();
                }}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );
        const Add = ({ navigation }: { navigation: any }) => (
            <TouchableOpacity
                onPress={() => navigation.navigate('AddContacts')}
            >
                <View
                    style={{
                        width: 30,
                        height: 30,
                        borderRadius: 25,
                        backgroundColor: themeColor('chain'),
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    <AddIcon
                        fill={themeColor('background')}
                        width={12}
                        height={12}
                        style={{ alignSelf: 'center' }}
                    />
                </View>
            </TouchableOpacity>
        );
        const PayButton = ({ navigation }: { navigation: any }) => (
            <Chip
                title="Pay"
                titleStyle={{ color: 'black', fontSize: 16 }}
                buttonStyle={{
                    backgroundColor: themeColor('chain'),
                    minWidth: 70
                }}
                onPress={() => navigation.navigate('AddContacts')}
            />
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
                    leftComponent={<BackButton />}
                    backgroundColor="none"
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                    rightComponent={
                        SendScreen ? (
                            <PayButton navigation={navigation} />
                        ) : (
                            <Add navigation={navigation} />
                        )
                    }
                />
                <View>
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
                                            'views.Settings.ContactsSettings.searchBar1'
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
                                        'views.Settings.ContactsSettings.searchBar2'
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

                    {/* Render favorite contacts */}
                    {favoriteContacts.length > 0 && (
                        <View style={{ margin: 28 }}>
                            <Text
                                style={{
                                    fontSize: 16,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString(
                                    'views.Settings.ContactsSettings.favorites'
                                )}{' '}
                                ({favoriteContacts.length})
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
                                {localeString(
                                    'views.Settings.ContactsSettings.contacts'
                                )}{' '}
                                ({nonFavoriteContacts.length})
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
                                    'views.Settings.ContactsSettings.noContacts'
                                )}
                                icon={{
                                    name: 'error-outline',
                                    size: 25,
                                    color: themeColor('text')
                                }}
                                iconOnly
                            />
                        )
                    )}
                </View>
            </Screen>
        );
    }
}
