import * as React from 'react';
import { Text, View, TouchableOpacity, FlatList, Image } from 'react-native';
import { Header, Icon, SearchBar } from 'react-native-elements';
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
}

export default class ContactsSettings extends React.Component<
    ContactsSettingsProps,
    ContactsSettingsState
> {
    constructor(props: ContactsSettingsProps) {
        super(props);
        this.state = {
            contacts: [],
            search: ''
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
        <View
            style={{
                marginVertical: 10,
                paddingLeft: 16,
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
                    style={{ fontSize: 16, color: themeColor('secondaryText') }}
                >
                    {item.lnAddress}
                </Text>
            </View>
        </View>
    );

    updateSearch = (query: string) => {
        this.setState({ search: query });
    };

    render() {
        const { navigation } = this.props;
        const { search, contacts } = this.state;
        const filteredContacts = contacts.filter(
            (contact) =>
                contact.name.includes(search) ||
                contact.lnAddress.includes(search) ||
                contact.nip05.includes(search) ||
                contact.onchainAddress.includes(search) ||
                contact.nostrNpub.includes(search)
        );

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
                <AddIcon
                    fill={themeColor('text')}
                    width="25"
                    height="25"
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
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
                    rightComponent={<Add navigation={navigation} />}
                />
                <View>
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

                    <View style={{ margin: 18 }}>
                        <Text style={{ fontSize: 18 }}>
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
