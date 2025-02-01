import * as React from 'react';
import {
    Text,
    View,
    TouchableOpacity,
    FlatList,
    Image,
    ScrollView
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { SearchBar, Divider } from 'react-native-elements';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Screen from '../../components/Screen';
import Button from '../../components/Button';
import LoadingIndicator from '../../components/LoadingIndicator';
import Header from '../../components/Header';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Storage from '../../storage';

import Contact from '../../models/Contact';

import ContactStore, { CONTACTS_KEY } from '../../stores/ContactStore';

import Add from '../../assets/images/SVG/Add.svg';
import NostrichIcon from '../../assets/images/SVG/Nostrich.svg';

interface ContactsSettingsProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'Contacts', { SendScreen: boolean }>;
    ContactStore: ContactStore;
}

interface ContactsSettingsState {
    search: string;
    SendScreen: boolean;
    deletionAwaitingConfirmation: boolean;
}

@inject('ContactStore')
@observer
export default class Contacts extends React.Component<
    ContactsSettingsProps,
    ContactsSettingsState
> {
    constructor(props: ContactsSettingsProps) {
        super(props);
        const SendScreen = this.props.route.params?.SendScreen;
        this.state = {
            search: '',
            SendScreen,
            deletionAwaitingConfirmation: false
        };
    }

    componentDidMount() {
        this.props.navigation.addListener('focus', () => {
            this.props.ContactStore?.loadContacts();
        });
    }

    displayAddress = (item: Contact) => {
        const contact = new Contact(item);
        const {
            hasLnAddress,
            hasBolt12Address,
            hasBolt12Offer,
            hasOnchainAddress,
            hasPubkey,
            hasMultiplePayableAddresses
        } = contact;

        if (hasMultiplePayableAddresses) {
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

        if (hasBolt12Address) {
            return item.bolt12Address[0].length > 23
                ? `${item.bolt12Address[0].slice(
                      0,
                      10
                  )}...${item.bolt12Address[0].slice(-10)}`
                : item.bolt12Address[0];
        }

        if (hasBolt12Offer) {
            return item.bolt12Offer[0].length > 23
                ? `${item.bolt12Offer[0].slice(
                      0,
                      10
                  )}...${item.bolt12Offer[0].slice(-10)}`
                : item.bolt12Offer[0];
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

        return localeString('views.Settings.Contacts.noAddress');
    };

    renderContactItem = ({ item }: { item: Contact }) => {
        const contact = new Contact(item);
        const { hasMultiplePayableAddresses } = contact;
        return (
            <TouchableOpacity
                onPress={() => {
                    if (this.state.SendScreen && !hasMultiplePayableAddresses) {
                        if (contact.isSingleLnAddress) {
                            this.props.navigation.navigate('Send', {
                                destination: item.lnAddress[0],
                                contactName: item.name
                            });
                        } else if (contact.isSingleBolt12Address) {
                            this.props.navigation.navigate('Send', {
                                destination: item.bolt12Address[0],
                                contactName: item.name
                            });
                        } else if (contact.isSingleBolt12Offer) {
                            this.props.navigation.navigate('Send', {
                                destination: item.bolt12Offer[0],
                                contactName: item.name
                            });
                        } else if (contact.isSingleOnchainAddress) {
                            this.props.navigation.navigate('Send', {
                                destination: item.onchainAddress[0],
                                contactName: item.name
                            });
                        } else if (contact.isSinglePubkey) {
                            this.props.navigation.navigate('Send', {
                                destination: item.pubkey[0],
                                contactName: item.name
                            });
                        }
                    } else {
                        this.props.navigation.navigate('ContactDetails', {
                            contactId: item.contactId || item.id,
                            isNostrContact: false
                        });
                    }
                }}
            >
                <View
                    style={{
                        marginHorizontal: 28,
                        paddingBottom: 20,
                        flexDirection: 'row',
                        alignItems: 'center'
                    }}
                >
                    {contact.photo && (
                        <Image
                            source={{ uri: contact.getPhoto }}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                marginRight: 10
                            }}
                        />
                    )}
                    <View>
                        <Text
                            style={{ fontSize: 16, color: themeColor('text') }}
                        >
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
    };

    updateSearch = (query: string) => {
        this.setState({ search: query });
    };

    render() {
        const { navigation, ContactStore } = this.props;
        const { loading } = ContactStore;
        const { search, SendScreen, deletionAwaitingConfirmation } = this.state;
        const { contacts } = ContactStore;
        const filteredContacts = contacts.filter((contact: any) => {
            const hasMatch = (field: string) =>
                Array.isArray(contact[field])
                    ? contact[field].some((input: string) =>
                          input.toLowerCase().includes(search.toLowerCase())
                      )
                    : contact[field]
                          ?.toLowerCase()
                          .includes(search.toLowerCase());

            return (
                hasMatch('name') ||
                hasMatch('description') ||
                hasMatch('lnAddress') ||
                hasMatch('bolt12Address') ||
                hasMatch('bolt12Offer') ||
                hasMatch('nip05') ||
                hasMatch('onchainAddress') ||
                hasMatch('nostrNpub') ||
                hasMatch('pubkey')
            );
        });

        const AddButton = () => (
            <TouchableOpacity
                onPress={() => navigation.navigate('AddContact')}
                accessibilityLabel={localeString('general.add')}
            >
                <Add
                    fill={themeColor('text')}
                    width="30"
                    height="30"
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        const favoriteContacts = filteredContacts.filter(
            (contact: Contact) => contact.isFavourite
        );
        const nonFavoriteContacts = filteredContacts.filter(
            (contact: Contact) => !contact.isFavourite
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
                    containerStyle={{ borderBottomWidth: 0 }}
                    centerComponent={
                        SendScreen ? undefined : (
                            <NostrichIcon
                                onPress={() =>
                                    navigation.navigate('NostrContacts')
                                }
                                fill={themeColor('text')}
                                width={30}
                                height={30}
                            />
                        )
                    }
                    rightComponent={SendScreen ? undefined : <AddButton />}
                    placement="right"
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
                                    // @ts-ignore:next-line
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
                                    // @ts-ignore:next-line
                                    searchIcon={
                                        <Text
                                            style={{
                                                fontSize: 20,
                                                color: themeColor('text'),
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.Contacts.to'
                                            )}
                                        </Text>
                                    }
                                    leftIconContainerStyle={{
                                        marginLeft: 18,
                                        marginRight: -8,
                                        marginBottom: 6
                                    }}
                                    multiline={true}
                                />
                                <Divider orientation="horizontal" />
                            </View>
                        ) : (
                            <SearchBar
                                placeholder={localeString(
                                    'views.Settings.Contacts.searchBar2'
                                )}
                                // @ts-ignore:next-line
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
                        keyExtractor={(_item, index) => index.toString()}
                        scrollEnabled={false}
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
                        keyExtractor={(_, index) => index.toString()}
                        scrollEnabled={false}
                    />
                    {!loading && contacts.length > 1 && (
                        <Button
                            title={
                                deletionAwaitingConfirmation
                                    ? localeString(
                                          'views.Settings.AddEditNode.tapToConfirm'
                                      )
                                    : localeString(
                                          'views.Settings.Contacts.deleteAllContacts'
                                      )
                            }
                            onPress={async () => {
                                if (!deletionAwaitingConfirmation) {
                                    this.setState({
                                        deletionAwaitingConfirmation: true
                                    });
                                } else {
                                    await Storage.setItem(CONTACTS_KEY, []);
                                    this.setState({
                                        deletionAwaitingConfirmation: false
                                    });
                                    ContactStore?.loadContacts();
                                }
                            }}
                            containerStyle={{
                                borderColor: themeColor('delete')
                            }}
                            titleStyle={{
                                color: themeColor('delete')
                            }}
                            secondary
                        />
                    )}
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
                                onPress={() => ContactStore?.loadContacts()}
                            />
                        )
                    )}
                </ScrollView>
            </Screen>
        );
    }
}
