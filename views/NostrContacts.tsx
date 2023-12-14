import * as React from 'react';
import {
    Alert,
    FlatList,
    Image,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import Screen from '../components/Screen';
import Button from '../components/Button';
import { themeColor } from '../utils/ThemeUtils';
import Header from '../components/Header';
import TextInput from '../components/TextInput';
import LoadingIndicator from '../components/LoadingIndicator';

import { relayInit, nip19 } from 'nostr-tools';
import EncryptedStorage from 'react-native-encrypted-storage';
import { localeString } from '../utils/LocaleUtils';
import Edit from '../assets/images/SVG/Pen.svg';

interface NostrContactsProps {
    navigation: any;
}

interface NostrContactsState {
    npub: string;
    ContactsData: any[];
    loading: boolean;
    isSelectionMode: boolean;
    SelectedContacts: any[];
}

export default class NostrContacts extends React.Component<
    NostrContactsProps,
    NostrContactsState
> {
    constructor(props: NostrContactsProps) {
        super(props);
        this.state = {
            npub: '',
            ContactsData: [],
            loading: false,
            isSelectionMode: false,
            SelectedContacts: []
        };
    }

    toggleSelectionMode = () => {
        this.setState((prevState) => ({
            isSelectionMode: !prevState.isSelectionMode,
            SelectedContacts: []
        }));
    };

    async fetchNostrContacts() {
        this.setState({ loading: true });

        const relay = relayInit('wss://relay.damus.io');
        await relay.connect();
        let { data } = nip19.decode(this.state.npub);
        let pubkey: any = data;

        let eventReceived = await relay.list([
            {
                authors: [pubkey],
                kinds: [3]
            }
        ]);

        let latestContactEvent: any;

        eventReceived.forEach((content) => {
            if (
                !latestContactEvent ||
                content.created_at > latestContactEvent.created_at
            ) {
                latestContactEvent = content;
            }
        });

        const tags: any = [];
        latestContactEvent.tags.forEach((tag: any) => {
            if (tag[0] === 'p') {
                tags.push(tag[1]);
            }
        });

        const profilesEvents = await relay.list([
            {
                authors: tags,
                kinds: [0]
            }
        ]);

        const newContactDataIndexByName: any = {};
        const newContactDataIndexByPubkey: any = {};
        const newContactsData: any[] = [];

        profilesEvents.forEach((item) => {
            try {
                const content = JSON.parse(item.content);
                if (
                    !newContactDataIndexByPubkey[item.pubkey] ||
                    item.created_at >
                        newContactDataIndexByPubkey[item.pubkey].timestamp
                ) {
                    newContactDataIndexByPubkey[item.pubkey] = {
                        content,
                        timestamp: item.created_at
                    };
                }
            } catch (error: any) {
                // Handle the error, e.g., log it or skip this item
                this.setState({ loading: false });
                console.error(
                    `Error parsing JSON for item with ID ${item.id}: ${error.message}`
                );
            }
        });
        Object.keys(newContactDataIndexByPubkey).forEach((pubkey) => {
            const content = newContactDataIndexByPubkey[pubkey].content;
            newContactDataIndexByName[
                content?.display_name?.toLowerCase() ||
                    content?.name?.toLowerCase()
            ] = content;
        });

        Object.keys(newContactDataIndexByName)
            .sort()
            .forEach((name) => {
                newContactsData.push(newContactDataIndexByName[name]);
            });
        this.setState({
            ContactsData: newContactsData,
            loading: false
        });
    }

    transformContactData = (contact: any) => {
        return {
            photo: contact?.picture,
            name: contact?.display_name || contact?.name,
            description: contact?.about,
            lnAddress: contact?.lud16
                ? [contact?.lud16]
                : contact?.lud06
                ? [contact?.lud06]
                : contact?.lud16 && contact?.lud06
                ? [contact?.lud06, contact?.lud16]
                : [],
            onchainAddress: [''],
            pubkey: contact?.pubkey ? [contact?.pubkey] : [],
            nip05: contact?.nip05 ? [contact?.nip05] : [],
            nostrNpub: contact?.npub ? [contact?.npub] : [],
            id: uuidv4(),
            isFavourite: false,
            banner: contact?.banner
        };
    };

    toggleContactSelection = (contact: any) => {
        this.setState((prevState) => {
            const SelectedContacts = [...prevState.SelectedContacts];
            const index = SelectedContacts.findIndex(
                (c) => c.id === contact.id
            );
            console.log(index);

            if (index === -1) {
                // Contact not selected, add it to the selection
                SelectedContacts.push(contact);
            } else {
                // Contact already selected, remove it from the selection
                SelectedContacts.splice(index, 1);
            }

            return { SelectedContacts };
        });
    };

    renderContactItem = ({
        item
    }: {
        item: {
            name: string;
            display_name: string;
            picture: string;
            lud06: string;
            lud16: string;
        };
    }) => {
        const { isSelectionMode } = this.state;

        const truncateString = (str: string, maxLength: number) => {
            if (str.length <= maxLength) {
                return str;
            }
            return `${str.substring(0, 6)}...${str.substring(str.length - 6)}`;
        };

        if (!item.name && !item.display_name) {
            return null;
        }

        if (!item.picture) {
            return null;
        }

        return (
            <TouchableOpacity
                onPress={() => {
                    if (isSelectionMode) {
                        this.toggleContactSelection(
                            this.transformContactData(item)
                        );
                    } else {
                        this.props.navigation.navigate('ContactDetails', {
                            nostrContact: this.transformContactData(item),
                            isNostrContact: true
                        });
                    }
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
                    {item.picture && (
                        <Image
                            source={{ uri: item.picture }}
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
                            style={{
                                fontSize: 16,
                                color: themeColor('text')
                            }}
                        >
                            {item.display_name || item.name}
                        </Text>
                        {item.lud06 && (
                            <Text
                                style={{
                                    fontSize: 16,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {truncateString(item.lud06, 25)}
                            </Text>
                        )}
                        {item.lud16 && (
                            <Text
                                style={{
                                    fontSize: 16,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {truncateString(item.lud16, 25)}
                            </Text>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    importSelectedContacts = async () => {
        try {
            const { SelectedContacts } = this.state;

            // Retrieve existing contacts from Encrypted storage
            const contactsString = await EncryptedStorage.getItem(
                'zeus-contacts'
            );
            const existingContacts: any = contactsString
                ? JSON.parse(contactsString)
                : [];

            // Merge existing contacts with the selected contacts
            const updatedContacts = [
                ...existingContacts,
                ...SelectedContacts
            ].sort((a, b) => a.name.localeCompare(b.name));

            // Save the updated contacts to encrypted storage
            await EncryptedStorage.setItem(
                'zeus-contacts',
                JSON.stringify(updatedContacts)
            );

            console.log('Contacts imported successfully!');
        } catch (error) {
            console.log('Error importing contacts:', error);
            Alert.alert(
                'Error',
                'Failed to import contacts. Please try again.'
            );
        }
    };

    importAllContacts = async () => {
        try {
            const contactsToImport = this.state.ContactsData;

            // Transform Nostr contacts data to match the format in AddContact
            const transformedContacts = contactsToImport.map((contact) =>
                this.transformContactData(contact)
            );

            // Retrieve existing contacts from Encrypted storage
            const contactsString = await EncryptedStorage.getItem(
                'zeus-contacts'
            );
            const existingContacts: any = contactsString
                ? JSON.parse(contactsString)
                : [];

            // Merge existing contacts with the new contacts
            const updatedContacts = [
                ...existingContacts,
                ...transformedContacts
            ].sort((a, b) => a.name.localeCompare(b.name));

            // Save the updated contacts to encrypted storage
            await EncryptedStorage.setItem(
                'zeus-contacts',
                JSON.stringify(updatedContacts)
            );

            console.log('Contacts imported successfully!');
        } catch (error) {
            console.log('Error importing contacts:', error);
            Alert.alert(
                'Error',
                'Failed to import contacts. Please try again.'
            );
        }
    };

    render() {
        const { navigation } = this.props;
        const { loading } = this.state;

        const SelectButton = () => (
            <TouchableOpacity
                onPress={() => {
                    this.toggleSelectionMode();
                }}
            >
                <Edit
                    fill={themeColor('text')}
                    style={{ marginRight: 15, alignSelf: 'center' }}
                />
            </TouchableOpacity>
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
                    centerComponent={{
                        text: localeString('views.NostrContacts.NostrContacts'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        this.state.ContactsData.length > 0 && <SelectButton />
                    }
                    navigation={navigation}
                />
                <Text
                    style={{
                        marginLeft: 22,
                        color: themeColor('secondaryText'),
                        fontSize: 16
                    }}
                >
                    Enter npub
                </Text>
                <TextInput
                    placeholder={'npub...'}
                    value={this.state.npub}
                    style={{
                        marginHorizontal: 22
                    }}
                    onChangeText={(text: string) =>
                        this.setState({
                            npub: text
                        })
                    }
                />
                <Button
                    onPress={() => this.fetchNostrContacts()}
                    title={localeString('views.NostrContacts.LookUpContacts')}
                    containerStyle={{ marginTop: 20, marginBottom: 8 }}
                    disabled={!this.state.npub}
                />
                {loading ? (
                    <LoadingIndicator />
                ) : (
                    <FlatList
                        data={this.state.ContactsData}
                        renderItem={this.renderContactItem}
                        keyExtractor={(item, index) => index.toString()}
                    />
                )}
                {this.state.ContactsData.length > 0 &&
                    this.state.SelectedContacts.length === 0 && (
                        <Button
                            title={localeString(
                                'views.NostrContacts.ImportAllContacts'
                            )}
                            onPress={() => {
                                this.importAllContacts();
                                this.props.navigation.navigate('Contacts');
                            }}
                            containerStyle={{
                                paddingBottom: 12,
                                paddingTop: 8
                            }}
                            secondary
                        />
                    )}
                {this.state.SelectedContacts.length > 0 && (
                    <Button
                        title={`Import ${this.state.SelectedContacts.length} Contacts`}
                        onPress={() => {
                            this.importSelectedContacts();
                            this.props.navigation.navigate('Contacts');
                        }}
                        containerStyle={{ paddingBottom: 12, paddingTop: 8 }}
                        secondary
                    />
                )}
            </Screen>
        );
    }
}
