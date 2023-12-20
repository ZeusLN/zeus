import * as React from 'react';
import {
    Alert,
    FlatList,
    Image,
    Text,
    TouchableOpacity,
    View,
    Animated,
    Easing
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import Screen from '../components/Screen';
import Button from '../components/Button';
import { themeColor } from '../utils/ThemeUtils';
import AddressUtils from '../utils/AddressUtils';

import Header from '../components/Header';
import TextInput from '../components/TextInput';
import LoadingIndicator from '../components/LoadingIndicator';
import { Row } from '../components/layout/Row';

import { relayInit, nip19 } from 'nostr-tools';
import EncryptedStorage from 'react-native-encrypted-storage';
import { localeString } from '../utils/LocaleUtils';
import { CheckBox, Icon } from 'react-native-elements';
import { DEFAULT_NOSTR_RELAYS } from '../stores/SettingsStore';

import SelectOff from '../assets/images/SVG/SelectOff.svg';
import SelectOn from '../assets/images/SVG/SelectON.svg';

interface NostrContactsProps {
    navigation: any;
}

interface NostrContactsState {
    npub: string;
    contactsData: any[];
    loading: boolean;
    isSelectionMode: boolean;
    selectedContacts: any[];
    fadeAnim: any;
    isValidNpub: boolean;
}

export default class NostrContacts extends React.Component<
    NostrContactsProps,
    NostrContactsState
> {
    constructor(props: NostrContactsProps) {
        super(props);
        this.state = {
            npub: '',
            contactsData: [],
            loading: false,
            isSelectionMode: false,
            selectedContacts: [],
            fadeAnim: new Animated.Value(0),
            isValidNpub: false
        };
    }

    toggleSelectionMode = () => {
        this.setState((prevState) => ({
            isSelectionMode: !prevState.isSelectionMode,
            selectedContacts: []
        }));
        Animated.timing(this.state.fadeAnim, {
            toValue: this.state.isSelectionMode ? 0 : 1,
            duration: 100,
            easing: Easing.ease,
            useNativeDriver: false
        }).start(() => {
            if (!this.state.isSelectionMode) {
                this.setState({ selectedContacts: [] });
            }
        });
    };

    async fetchNostrContacts() {
        this.setState({ loading: true });
        let { data } = nip19.decode(this.state.npub);

        DEFAULT_NOSTR_RELAYS.map(async (relayItem) => {
            const relay = relayInit(relayItem);
            relay.on('connect', () => {
                console.log(`connected to ${relay.url}`);
            });
            relay.on('error', () => {
                console.log(`failed to connect to ${relay.url}`);
            });

            await relay.connect();

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
                if (!content?.npub) {
                    content.npub = nip19.npubEncode(pubkey);
                }
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
                contactsData: newContactsData,
                loading: false
            });
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
            banner: contact?.banner,
            isSelected: false
        };
    };

    toggleContactSelection = (contact: any) => {
        this.setState((prevState) => {
            const selectedContacts = [...prevState.selectedContacts];
            const index = selectedContacts.findIndex(
                (c) => c.banner === contact.banner
            );

            if (index === -1) {
                // Contact not selected, add it to the selection
                selectedContacts.push({ ...contact, isSelected: true });
            } else {
                // Contact already selected, remove it from the selection
                selectedContacts.splice(index, 1);
            }

            return { selectedContacts };
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
            banner: string;
        };
    }) => {
        const { isSelectionMode } = this.state;
        const isSelected = this.state.selectedContacts.some(
            (c) => c.banner === item.banner && c.isSelected
        );

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

        const slideInRight = this.state.fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [10, 0]
        });
        const slideInLeft = this.state.fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 10]
        });

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
                style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start'
                }}
            >
                {isSelectionMode && (
                    // Use Animated.View for the container
                    <Animated.View
                        style={{
                            marginRight: -30,
                            transform: [{ translateX: slideInRight }]
                        }}
                    >
                        <CheckBox checked={isSelected} />
                    </Animated.View>
                )}

                <Animated.View
                    style={{
                        marginHorizontal: 24,
                        paddingBottom: 20,
                        flexDirection: 'row',
                        alignItems: 'center',
                        transform: [{ translateX: slideInLeft }]
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
                </Animated.View>
            </TouchableOpacity>
        );
    };

    importSelectedContacts = async () => {
        try {
            const { selectedContacts } = this.state;

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
                ...selectedContacts
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
            const contactsToImport = this.state.contactsData;

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

    handleNostrValidation = (text: string) => {
        const isValidNpub = AddressUtils.isValidNpub(text);
        this.setState({ isValidNpub });
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
                {this.state.isSelectionMode ? (
                    <SelectOn
                        height={32}
                        width={32}
                        fill="white"
                        style={{
                            borderRadius: 2,
                            marginRight: 2,
                            alignSelf: 'center',
                            marginTop: -6
                        }}
                    />
                ) : (
                    <SelectOff
                        height={36}
                        width={36}
                        fill="white"
                        style={{
                            borderRadius: 2,
                            marginRight: 2,
                            alignSelf: 'center',
                            marginTop: -6
                        }}
                    />
                )}
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
                        <Row>
                            {this.state.contactsData.length > 0 && (
                                <>
                                    <SelectButton />
                                    <Icon
                                        onPress={() => {
                                            this.setState({
                                                contactsData: [],
                                                selectedContacts: [],
                                                npub: '',
                                                isSelectionMode: false
                                            });
                                        }}
                                        name="close"
                                        type="material"
                                        size={38}
                                        color={themeColor('text')}
                                        containerStyle={{ marginTop: -12 }}
                                    />
                                </>
                            )}
                        </Row>
                    }
                    navigation={navigation}
                />

                {this.state.contactsData.length === 0 && !loading && (
                    <>
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
                                marginHorizontal: 22,
                                borderColor:
                                    !this.state.isValidNpub &&
                                    this.state.npub.length > 0
                                        ? themeColor('delete')
                                        : 'transparent',
                                borderWidth: 1
                            }}
                            onChangeText={(text: string) => {
                                if (!text) {
                                    this.setState({ isValidNpub: true });
                                }
                                this.setState({ npub: text });
                                this.handleNostrValidation(text);
                            }}
                        />

                        <Button
                            onPress={() => this.fetchNostrContacts()}
                            title={localeString(
                                'views.NostrContacts.LookUpContacts'
                            )}
                            containerStyle={{
                                marginTop: 20,
                                marginBottom: 8
                            }}
                            disabled={!this.state.isValidNpub}
                        />
                    </>
                )}

                {loading ? (
                    <View style={{ marginTop: 60 }}>
                        <LoadingIndicator />
                    </View>
                ) : (
                    <FlatList
                        data={this.state.contactsData}
                        style={{ marginTop: 10 }}
                        renderItem={this.renderContactItem}
                        keyExtractor={(item, index) => index.toString()}
                    />
                )}
                {this.state.contactsData.length > 0 &&
                    this.state.selectedContacts.length === 0 && (
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
                {this.state.selectedContacts.length > 0 && (
                    <Button
                        title={`Import ${this.state.selectedContacts.length} Contacts`}
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
