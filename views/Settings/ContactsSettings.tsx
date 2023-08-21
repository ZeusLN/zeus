import * as React from 'react';
import { Text, View, TouchableOpacity, FlatList, Image } from 'react-native';
import { Header, Icon, SearchBar, Chip, Divider } from 'react-native-elements';
import AddIcon from '../../assets/images/SVG/Add.svg';
import EncryptedStorage from 'react-native-encrypted-storage';

import { themeColor } from '../../utils/ThemeUtils';

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
}

interface ContactsSettingsState {
    contacts: ContactItem[];
    search: string;
    SendScreen: boolean;
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
            SendScreen
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
                    this.setState({ contacts });
                }
            } catch (error) {
                console.log('Error loading contacts:', error);
            }
        });
    };

    renderContactItem = ({ item }: { item: ContactItem }) => (
        <TouchableOpacity
            onPress={() =>
                this.state.SendScreen &&
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
                        {item.lnAddress.length === 1
                            ? item.lnAddress[0].length > 15
                                ? `${item.lnAddress[0].slice(
                                      0,
                                      4
                                  )}...${item.lnAddress[0].slice(-4)}`
                                : item.lnAddress
                            : 'multiple addresses'}
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
        const { search, contacts, SendScreen } = this.state;
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
                    navigation.navigate('Settings', {
                        refresh: true
                    });
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

        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    backgroundColor={themeColor('background')}
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
                    {SendScreen ? (
                        <View>
                            <Divider
                                orientation="horizontal"
                                style={{ marginTop: 14 }}
                            />
                            <SearchBar
                                placeholder="NOSTR Npub, NIP05, LN address, Onchain address"
                                onChangeText={this.updateSearch}
                                value={this.state.search}
                                inputStyle={{
                                    color: themeColor('text')
                                }}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
                                containerStyle={{
                                    backgroundColor: themeColor('background'),
                                    borderTopWidth: 0,
                                    borderBottomWidth: 0
                                }}
                                inputContainerStyle={{
                                    backgroundColor: themeColor('background')
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
                            placeholder="Search"
                            onChangeText={this.updateSearch}
                            value={this.state.search}
                            inputStyle={{
                                color: themeColor('text')
                            }}
                            placeholderTextColor={themeColor('secondaryText')}
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

                    <View style={{ margin: 28 }}>
                        <Text
                            style={{
                                fontSize: 18,
                                color: themeColor('secondaryText')
                            }}
                        >
                            Contacts ({filteredContacts.length})
                        </Text>
                    </View>
                    <FlatList
                        data={filteredContacts}
                        renderItem={this.renderContactItem}
                        keyExtractor={(item, index) => index.toString()}
                    />
                </View>
            </View>
        );
    }
}
