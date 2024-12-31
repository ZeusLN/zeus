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
import { inject, observer } from 'mobx-react';
import { CheckBox, Icon } from 'react-native-elements';
// @ts-ignore:next-line
import { relayInit, nip05, nip19 } from 'nostr-tools';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../components/Button';
import Header from '../components/Header';
import Screen from '../components/Screen';
import TextInput from '../components/TextInput';
import LoadingIndicator from '../components/LoadingIndicator';
import { ErrorMessage } from '../components/SuccessErrorMessage';
import { Row } from '../components/layout/Row';

import AddressUtils from '../utils/AddressUtils';
import ContactUtils from '../utils/ContactUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import Storage from '../storage';

import { DEFAULT_NOSTR_RELAYS } from '../stores/SettingsStore';
import ContactStore, { MODERN_CONTACTS_KEY } from '../stores/ContactStore';

import SelectOff from '../assets/images/SVG/Select Off.svg';
import SelectOn from '../assets/images/SVG/Select On.svg';

interface NostrContactsProps {
    navigation: StackNavigationProp<any, any>;
    ContactStore: ContactStore;
}

interface NostrContactsState {
    account: string;
    contactsData: any[];
    loading: boolean;
    isSelectionMode: boolean;
    selectedContacts: any[];
    fadeAnim: any;
    isValid: boolean;
    isValidNpub: boolean;
    isValidNip05: boolean;
    error: string;
}

@inject('ContactStore')
@observer
export default class NostrContacts extends React.Component<
    NostrContactsProps,
    NostrContactsState
> {
    constructor(props: NostrContactsProps) {
        super(props);
        this.state = {
            account: '',
            contactsData: [],
            loading: false,
            isSelectionMode: false,
            selectedContacts: [],
            fadeAnim: new Animated.Value(0),
            isValid: false,
            isValidNpub: false,
            isValidNip05: false,
            error: ''
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
        this.setState({ loading: true, error: '' });
        const { account } = this.state;

        let pubkey: string;
        if (this.state.isValidNpub) {
            const decoded = nip19.decode(account);
            pubkey = decoded.data.toString();
        } else if (this.state.isValidNip05) {
            try {
                const lookup: any = await nip05.queryProfile(account);
                pubkey = lookup.pubkey;
            } catch (e) {
                this.setState({
                    loading: false,
                    error: localeString('views.NostrContacts.nip05Error')
                });
                return;
            }
        }

        const profilesEventsPromises = DEFAULT_NOSTR_RELAYS.map(
            async (relayItem) => {
                try {
                    const relay = relayInit(relayItem);
                    const tags: Array<string> = [];

                    relay.on('connect', () => {
                        console.log(`connected to ${relay.url}`);
                    });

                    relay.on('error', (): any => {
                        console.log(`failed to connect to ${relay.url}`);
                    });

                    await relay.connect();
                    let eventReceived = await relay.list([
                        {
                            authors: [pubkey],
                            kinds: [3]
                        }
                    ]);

                    let latestContactEvent: any;

                    eventReceived.forEach((content: any) => {
                        if (
                            !latestContactEvent ||
                            content.created_at > latestContactEvent.created_at
                        ) {
                            latestContactEvent = content;
                        }
                    });

                    if (!latestContactEvent) return;

                    latestContactEvent.tags.forEach((tag: string) => {
                        if (tag[0] === 'p') {
                            tags.push(tag[1]);
                        }
                    });

                    return relay.list([
                        {
                            authors: tags,
                            kinds: [0]
                        }
                    ]);
                } catch (e) {}
            }
        );

        Promise.all(profilesEventsPromises)
            .then((profilesEventsArrays) => {
                const profileEvents = profilesEventsArrays
                    .flat()
                    .filter((event) => event !== undefined);
                const newContactDataIndexByName: any = {};
                const newContactDataIndexByPubkey: any = {};
                const newContactsData: any[] = [];

                profileEvents.forEach((item: any) => {
                    try {
                        const content = JSON.parse(item.content);
                        if (
                            !newContactDataIndexByPubkey[item.pubkey] ||
                            item.created_at >
                                newContactDataIndexByPubkey[item.pubkey]
                                    .timestamp
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
            })
            .catch((error) => {
                console.error('Error fetching profiles events:', error);
            });
    }

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
        const { navigation } = this.props;
        const isSelected = this.state.selectedContacts.some(
            (c) => c.banner === item.banner && c.isSelected
        );

        const truncateString = (str: string, maxLength: number) => {
            if (str.length <= maxLength) {
                return str;
            }
            return `${str.substring(0, 6)}...${str.substring(str.length - 6)}`;
        };

        if (!item?.name && !item?.display_name) {
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
                onPress={async () => {
                    if (isSelectionMode) {
                        this.toggleContactSelection(item);
                    } else {
                        navigation.navigate('ContactDetails', {
                            nostrContact:
                                await ContactUtils.transformContactData(item),
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
                        <CheckBox
                            checked={isSelected}
                            onPress={() => {
                                this.toggleContactSelection(item);
                            }}
                        />
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
                            {item?.display_name || item?.name}
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

    importContacts = async () => {
        const { ContactStore } = this.props;
        this.setState({
            loading: true
        });

        try {
            let contactsToImport = [];

            // Check if selectedContacts is not empty, use it; otherwise, use contactsData
            if (this.state.selectedContacts.length > 0) {
                contactsToImport = this.state.selectedContacts;
            } else {
                contactsToImport = this.state.contactsData;
            }

            // Remove null values and contacts without name or display_name
            contactsToImport = contactsToImport.filter(
                (contact) =>
                    contact !== null &&
                    (contact?.name || contact?.display_name) &&
                    contact?.picture &&
                    (contact?.lud06 || contact.lud16)
            );

            // Transform Nostr contacts data to match the format in AddContact
            const transformedContactsPromises = contactsToImport.map(
                (contact) => ContactUtils.transformContactData(contact)
            );

            const transformedContacts = await Promise.all(
                transformedContactsPromises
            );

            // Retrieve existing contacts from Encrypted storage
            const contactsString: any = await Storage.getItem(
                MODERN_CONTACTS_KEY
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
            await Storage.setItem(MODERN_CONTACTS_KEY, updatedContacts);

            console.log('Contacts imported successfully!');

            ContactStore?.loadContacts();
            this.setState({
                loading: false
            });
        } catch (error) {
            console.log('Error importing contacts:', error);
            Alert.alert(
                localeString('general.error'),
                localeString('views.NostrContacts.importContactsError')
            );
            this.setState({
                loading: false
            });
        }
    };

    handleNostrValidation = (text: string) => {
        const isValidNpub = AddressUtils.isValidNpub(text);
        const isValidNip05 = AddressUtils.isValidLightningAddress(text);
        const isValid = isValidNpub || isValidNip05;
        this.setState({ isValid, isValidNpub, isValidNip05 });
    };

    render() {
        const { navigation } = this.props;
        const {
            loading,
            contactsData,
            selectedContacts,
            isSelectionMode,
            isValid,
            account,
            error
        } = this.state;

        const SelectButton = () => (
            <TouchableOpacity
                onPress={() => {
                    this.toggleSelectionMode();
                }}
            >
                {isSelectionMode ? (
                    <SelectOn
                        height={36}
                        width={36}
                        fill="white"
                        style={{
                            borderRadius: 2,
                            marginRight: 2,
                            alignSelf: 'center',
                            marginTop: -12
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
                            marginTop: -12
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
                        text: localeString('views.NostrContacts.nostrContacts'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <Row>
                            {contactsData.length > 0 && !loading && (
                                <>
                                    <SelectButton />
                                    <Icon
                                        onPress={() => {
                                            this.setState({
                                                contactsData: [],
                                                selectedContacts: [],
                                                account: '',
                                                isSelectionMode: false,
                                                fadeAnim: new Animated.Value(0),
                                                isValid: false,
                                                isValidNpub: false,
                                                isValidNip05: false
                                            });
                                        }}
                                        name="close"
                                        type="material"
                                        size={50}
                                        color={themeColor('text')}
                                        containerStyle={{
                                            marginTop: -10,
                                            marginRight: -12
                                        }}
                                    />
                                </>
                            )}
                        </Row>
                    }
                    navigation={navigation}
                />

                {error && <ErrorMessage message={error} dismissable />}

                {contactsData.length === 0 && !loading && (
                    <>
                        <Text
                            style={{
                                marginLeft: 22,
                                color: themeColor('secondaryText'),
                                fontSize: 16
                            }}
                        >
                            {localeString('views.NostrContacts.enterNpub')}
                        </Text>
                        <TextInput
                            placeholder={
                                'npub1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5'
                            }
                            value={account}
                            style={{
                                marginHorizontal: 22,
                                borderColor:
                                    !isValid && account.length > 0
                                        ? themeColor('delete')
                                        : 'transparent',
                                borderWidth: 1
                            }}
                            onChangeText={(text: string) => {
                                if (!text) {
                                    this.setState({ isValid: true });
                                }
                                this.setState({ account: text, error: '' });
                                this.handleNostrValidation(text);
                            }}
                            autoCapitalize="none"
                        />

                        <Button
                            onPress={() => this.fetchNostrContacts()}
                            title={localeString(
                                'views.NostrContacts.lookUpContacts'
                            )}
                            containerStyle={{
                                marginTop: 20,
                                marginBottom: 8
                            }}
                            disabled={!isValid}
                        />
                    </>
                )}

                {loading ? (
                    <View style={{ marginTop: 60 }}>
                        <LoadingIndicator />
                    </View>
                ) : (
                    <FlatList
                        data={contactsData}
                        style={{ marginTop: 10 }}
                        renderItem={this.renderContactItem}
                        keyExtractor={(_, index) => index.toString()}
                    />
                )}
                {!loading &&
                    !isSelectionMode &&
                    contactsData.length > 0 &&
                    selectedContacts.length === 0 && (
                        <Button
                            title={localeString(
                                'views.NostrContacts.importAllContacts'
                            )}
                            onPress={async () => {
                                await this.importContacts();
                                navigation.popTo('Contacts');
                            }}
                            containerStyle={{
                                paddingBottom: 12,
                                paddingTop: 8
                            }}
                            secondary
                        />
                    )}
                {!loading && isSelectionMode && selectedContacts.length >= 0 && (
                    <Button
                        title={`${localeString(
                            'views.OpenChannel.import'
                        )} ${localeString('views.Settings.Contacts.contacts')}${
                            selectedContacts.length > 0
                                ? ` (${selectedContacts.length})`
                                : ''
                        }`}
                        onPress={async () => {
                            await this.importContacts();
                            navigation.popTo('Contacts');
                        }}
                        containerStyle={{ paddingBottom: 12, paddingTop: 8 }}
                        secondary
                        disabled={
                            isSelectionMode && selectedContacts.length === 0
                        }
                    />
                )}
            </Screen>
        );
    }
}
