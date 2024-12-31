import * as React from 'react';
import {
    Text,
    View,
    Image,
    StyleSheet,
    TouchableOpacity,
    ScrollView
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Screen from '../components/Screen';
import Button from '../components/Button';
import LoadingIndicator from '../components/LoadingIndicator';
import Header from '../components/Header';
import { Row } from '../components/layout/Row';

import ContactStore, { MODERN_CONTACTS_KEY } from '../stores/ContactStore';

import LightningBolt from '../assets/images/SVG/Lightning Bolt.svg';
import BitcoinIcon from '../assets/images/SVG/BitcoinIcon.svg';
import KeySecurity from '../assets/images/SVG/Key Security.svg';
import VerifiedAccount from '../assets/images/SVG/Verified Account.svg';
import EditContact from '../assets/images/SVG/Pen.svg';
import Star from '../assets/images/SVG/Star.svg';
import QR from '../assets/images/SVG/QR.svg';

import { themeColor } from '../utils/ThemeUtils';
import LinkingUtils from '../utils/LinkingUtils';
import { localeString } from '../utils/LocaleUtils';

import Storage from '../storage';

import Contact from '../models/Contact';

interface ContactDetailsProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'ContactDetails',
        {
            isNostrContact: boolean;
            contactId: string;
            nostrContact: any;
        }
    >;
    ContactStore: ContactStore;
}

interface ContactDetailsState {
    contact: Contact | any;
    isLoading: boolean;
    isNostrContact: boolean;
}

@inject('ContactStore')
@observer
export default class ContactDetails extends React.Component<
    ContactDetailsProps,
    ContactDetailsState
> {
    constructor(props: ContactDetailsProps) {
        super(props);

        this.state = {
            contact: {
                lnAddress: [''],
                bolt12Address: [''],
                bolt12Offer: [''],
                onchainAddress: [''],
                pubkey: [''],
                nip05: [''],
                nostrNpub: [''],
                name: '',
                description: '',
                photo: null,
                isFavourite: false,
                contactId: '',
                banner: '',
                id: ''
            },
            isLoading: true,
            isNostrContact: false
        };
    }

    async componentDidMount() {
        try {
            await this.fetchContact();

            const isNostrContact = this.props.route.params?.isNostrContact;

            this.setState({ isNostrContact });
        } catch (error) {
            console.error(error);
        }
    }

    fetchContact = async () => {
        this.props.navigation.addListener('focus', async () => {
            try {
                const { contactId, nostrContact, isNostrContact } =
                    this.props.route.params ?? {};
                const contactsString: any = await Storage.getItem(
                    MODERN_CONTACTS_KEY
                );

                if (contactsString && contactId) {
                    const existingContact = JSON.parse(contactsString);
                    const contact = existingContact.find(
                        (contact: Contact) =>
                            contact.contactId === contactId ||
                            contact.id === contactId
                    );

                    // Store the found contact in the component's state
                    this.setState({
                        contact,
                        isNostrContact,
                        isLoading: false
                    });
                } else {
                    this.setState({
                        contact: nostrContact,
                        isNostrContact,
                        isLoading: false
                    });
                }
            } catch (error) {
                console.log('Error fetching contact:', error);
                this.setState({ isLoading: false });
            }
        });
    };

    sendAddress = (address: string) => {
        const { navigation } = this.props;
        const { contact } = this.state;
        navigation.navigate('Send', {
            destination: address,
            contactName: contact.name
        });
    };

    saveUpdatedContact = async (updatedContact: Contact) => {
        const { ContactStore } = this.props;
        try {
            const contactsString: any = await Storage.getItem(
                MODERN_CONTACTS_KEY
            );

            if (contactsString) {
                const existingContacts: Contact[] = JSON.parse(contactsString);

                // Find the index of the contact with the same name
                const contactIndex = existingContacts.findIndex(
                    (contact) => contact.contactId === updatedContact.contactId
                );

                if (contactIndex !== -1) {
                    // Update the contact in the array
                    existingContacts[contactIndex] = updatedContact;

                    // Save the updated contacts back to storage
                    await Storage.setItem(
                        MODERN_CONTACTS_KEY,
                        existingContacts
                    );

                    console.log('Contact updated successfully!');
                    ContactStore?.loadContacts();
                }
            }
        } catch (error) {
            console.log('Error updating contact:', error);
        }
    };

    importToContacts = async () => {
        const { contact } = this.state;

        const contactsString: any = await Storage.getItem(MODERN_CONTACTS_KEY);

        const existingContacts: Contact[] = contactsString
            ? JSON.parse(contactsString)
            : [];

        const updatedContacts = [...existingContacts, contact].sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        await Storage.setItem(MODERN_CONTACTS_KEY, updatedContacts);

        console.log('Contact imported successfully!');
        this.props.navigation.popTo('Contacts');
    };

    toggleFavorite = () => {
        const { contact } = this.state;

        // Toggle the isFavourite field
        const updatedContact = {
            ...contact,
            isFavourite: !contact.isFavourite
        };

        // Save the updated contact
        this.saveUpdatedContact(updatedContact);

        // Update the state to reflect the changes
        this.setState({ contact: updatedContact });
    };

    handleNostr = (value: string) => {
        const deepLink = `nostr:${value}`;
        LinkingUtils.handleDeepLink(deepLink, this.props.navigation);
    };

    render() {
        const { isLoading, isNostrContact } = this.state;
        const { navigation, ContactStore } = this.props;
        const { setPrefillContact } = ContactStore;

        const contact = new Contact(this.state.contact);
        const nostrContact = this.props.route.params?.nostrContact;
        const StarButton = () => (
            <TouchableOpacity onPress={this.toggleFavorite}>
                <Star
                    fill={contact.isFavourite ? themeColor('text') : 'none'}
                    stroke={contact.isFavourite ? 'none' : themeColor('text')}
                    strokeWidth={2}
                    style={{ alignSelf: 'center', marginRight: 16 }}
                />
            </TouchableOpacity>
        );

        const EditContactButton = () => (
            <TouchableOpacity
                onPress={() => {
                    setPrefillContact(contact);
                    navigation.navigate('AddContact', {
                        isEdit: true
                    });
                }}
            >
                <EditContact
                    fill={themeColor('text')}
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        // Function to add prefixes to addresses based on their types
        const addPrefixToAddresses = (
            addresses: string[] | undefined,
            prefix: string
        ) =>
            (addresses || [])
                .filter(Boolean)
                .map((address) => `${prefix}${address}`);

        const QRButton = () => {
            const { lnAddress, onchainAddress, pubkey, nostrNpub, nip05 } =
                contact;
            return (
                <TouchableOpacity
                    onPress={() => {
                        const contactDataWithoutPhoto = {
                            ...this.state.contact
                        };

                        // Check if 'photo' exists and doesn't start with 'http'
                        if (
                            contactDataWithoutPhoto.photo &&
                            !contactDataWithoutPhoto.photo.startsWith('http')
                        ) {
                            delete contactDataWithoutPhoto.photo;
                        }

                        // Add the 'zeuscontact:' prefix to the contactData parameter
                        const zeusContactData = `zeuscontact:${JSON.stringify(
                            contactDataWithoutPhoto
                        )}`;
                        navigation.navigate('ContactQR', {
                            contactData: zeusContactData,
                            addressData: [
                                ...addPrefixToAddresses(
                                    lnAddress,
                                    'lightning:'
                                ),
                                ...addPrefixToAddresses(pubkey, 'lightning:'),
                                ...addPrefixToAddresses(
                                    onchainAddress,
                                    'bitcoin:'
                                ),
                                ...addPrefixToAddresses(nostrNpub, 'nostr:'),
                                ...addPrefixToAddresses(nip05, 'nostr:')
                            ]
                        });
                    }}
                >
                    <QR
                        fill={themeColor('text')}
                        style={{ alignSelf: 'center' }}
                    />
                </TouchableOpacity>
            );
        };

        return (
            <>
                {isLoading ? (
                    <Screen>
                        <Header
                            leftComponent="Back"
                            containerStyle={{
                                borderBottomWidth: 0
                            }}
                            navigation={navigation}
                        />
                        <View style={{ marginTop: 60 }}>
                            <LoadingIndicator />
                        </View>
                    </Screen>
                ) : (
                    <Screen>
                        <Header
                            leftComponent="Back"
                            centerComponent={
                                isNostrContact ? <></> : <EditContactButton />
                            }
                            rightComponent={
                                <Row>
                                    {!isNostrContact && <StarButton />}
                                    <QRButton />
                                </Row>
                            }
                            placement="right"
                            containerStyle={{
                                borderBottomWidth: 0
                            }}
                            navigation={navigation}
                        />
                        <ScrollView
                            contentContainerStyle={{
                                backgroundColor: 'none',
                                alignItems: 'center',
                                paddingBottom: 10
                            }}
                        >
                            {contact.banner && (
                                <Image
                                    source={{ uri: contact.getBanner }}
                                    style={{
                                        width: '100%',
                                        height: 150,
                                        marginBottom: 20
                                    }}
                                />
                            )}
                            {contact.photo && (
                                <Image
                                    source={{ uri: contact.getPhoto }}
                                    style={{
                                        width: 150,
                                        height: 150,
                                        borderRadius: 75,
                                        marginBottom: 20,
                                        marginTop: contact.banner ? -100 : 0
                                    }}
                                />
                            )}
                            <Text
                                style={{
                                    fontSize: 40,
                                    fontWeight: 'bold',
                                    marginBottom: 10,
                                    color: 'white'
                                }}
                            >
                                {contact.name}
                            </Text>
                            <Text
                                style={{
                                    fontSize: 20,
                                    marginBottom: 6,
                                    marginHorizontal: 20,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {contact.description
                                    .trim()
                                    .replace(/\s+/g, ' ')}
                            </Text>

                            {contact.hasLnAddress && (
                                <View>
                                    {contact.lnAddress.map(
                                        (address: string, index: number) => (
                                            <TouchableOpacity
                                                key={index}
                                                onPress={() =>
                                                    this.sendAddress(address)
                                                }
                                            >
                                                <View style={styles.contactRow}>
                                                    <LightningBolt />
                                                    <Text
                                                        style={{
                                                            ...styles.contactFields,
                                                            color: themeColor(
                                                                'chain'
                                                            )
                                                        }}
                                                    >
                                                        {address.length > 23
                                                            ? `${address.substring(
                                                                  0,
                                                                  10
                                                              )}...${address.substring(
                                                                  address.length -
                                                                      10
                                                              )}`
                                                            : address}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        )
                                    )}
                                </View>
                            )}

                            {contact.hasBolt12Address && (
                                <View>
                                    {contact.bolt12Address.map(
                                        (address: string, index: number) => (
                                            <TouchableOpacity
                                                key={index}
                                                onPress={() =>
                                                    this.sendAddress(address)
                                                }
                                            >
                                                <View style={styles.contactRow}>
                                                    <LightningBolt />
                                                    <Text
                                                        style={{
                                                            ...styles.contactFields,
                                                            color: themeColor(
                                                                'chain'
                                                            )
                                                        }}
                                                    >
                                                        {address.length > 23
                                                            ? `${address.substring(
                                                                  0,
                                                                  10
                                                              )}...${address.substring(
                                                                  address.length -
                                                                      10
                                                              )}`
                                                            : address}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        )
                                    )}
                                </View>
                            )}

                            {contact.hasBolt12Offer && (
                                <View>
                                    {contact.bolt12Offer.map(
                                        (address: string, index: number) => (
                                            <TouchableOpacity
                                                key={index}
                                                onPress={() =>
                                                    this.sendAddress(address)
                                                }
                                            >
                                                <View style={styles.contactRow}>
                                                    <LightningBolt />
                                                    <Text
                                                        style={{
                                                            ...styles.contactFields,
                                                            color: themeColor(
                                                                'chain'
                                                            )
                                                        }}
                                                    >
                                                        {address.length > 23
                                                            ? `${address.substring(
                                                                  0,
                                                                  10
                                                              )}...${address.substring(
                                                                  address.length -
                                                                      10
                                                              )}`
                                                            : address}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        )
                                    )}
                                </View>
                            )}

                            {contact.hasPubkey && (
                                <View>
                                    {contact.pubkey.map(
                                        (address: string, index: number) => (
                                            <TouchableOpacity
                                                key={index}
                                                onPress={() =>
                                                    this.sendAddress(address)
                                                }
                                            >
                                                <View
                                                    key={index}
                                                    style={styles.contactRow}
                                                >
                                                    <LightningBolt />
                                                    <Text
                                                        style={{
                                                            ...styles.contactFields,
                                                            color: themeColor(
                                                                'chain'
                                                            )
                                                        }}
                                                    >
                                                        {address.length > 23
                                                            ? `${address.substring(
                                                                  0,
                                                                  10
                                                              )}...${address.substring(
                                                                  address.length -
                                                                      10
                                                              )}`
                                                            : address}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        )
                                    )}
                                </View>
                            )}

                            {contact.hasOnchainAddress && (
                                <View>
                                    {contact.onchainAddress.map(
                                        (address: string, index: number) => (
                                            <TouchableOpacity
                                                key={index}
                                                onPress={() =>
                                                    this.sendAddress(address)
                                                }
                                            >
                                                <View
                                                    key={index}
                                                    style={styles.contactRow}
                                                >
                                                    <BitcoinIcon />
                                                    <Text
                                                        style={{
                                                            ...styles.contactFields,
                                                            color: themeColor(
                                                                'chain'
                                                            )
                                                        }}
                                                    >
                                                        {address.length > 23
                                                            ? `${address.substring(
                                                                  0,
                                                                  10
                                                              )}...${address.substring(
                                                                  address.length -
                                                                      10
                                                              )}`
                                                            : address}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        )
                                    )}
                                </View>
                            )}

                            {contact.hasNip05 && (
                                <View>
                                    {contact.nip05.map(
                                        (value: string, index: number) => (
                                            <TouchableOpacity
                                                key={index}
                                                onPress={() =>
                                                    this.handleNostr(value)
                                                }
                                            >
                                                <View
                                                    key={index}
                                                    style={styles.contactRow}
                                                >
                                                    <VerifiedAccount />
                                                    <Text
                                                        style={{
                                                            ...styles.contactFields,
                                                            color: themeColor(
                                                                'chain'
                                                            )
                                                        }}
                                                    >
                                                        {value.length > 15
                                                            ? `${value.substring(
                                                                  0,
                                                                  10
                                                              )}...${value.substring(
                                                                  value.length -
                                                                      5
                                                              )}`
                                                            : value}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        )
                                    )}
                                </View>
                            )}

                            {contact.hasNpub && (
                                <View>
                                    {contact.nostrNpub.map(
                                        (value: string, index: number) => (
                                            <TouchableOpacity
                                                key={index}
                                                onPress={() =>
                                                    this.handleNostr(value)
                                                }
                                            >
                                                <View style={styles.contactRow}>
                                                    <View>
                                                        <KeySecurity />
                                                    </View>
                                                    <Text
                                                        style={{
                                                            ...styles.contactFields,
                                                            color: themeColor(
                                                                'chain'
                                                            )
                                                        }}
                                                    >
                                                        {value.length > 15
                                                            ? `${value.substring(
                                                                  0,
                                                                  10
                                                              )}...${value.substring(
                                                                  value.length -
                                                                      5
                                                              )}`
                                                            : value}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        )
                                    )}
                                </View>
                            )}
                        </ScrollView>
                        {isNostrContact && (
                            <>
                                <Button
                                    onPress={() => this.importToContacts()}
                                    title={localeString(
                                        'views.ContactDetails.saveToContacts'
                                    )}
                                    containerStyle={{ paddingBottom: 12 }}
                                />
                                <Button
                                    onPress={() => {
                                        navigation.goBack();
                                        setPrefillContact(nostrContact);
                                        navigation.navigate('AddContact', {
                                            isEdit: true,
                                            isNostrContact
                                        });
                                    }}
                                    title={localeString(
                                        'views.ContactDetails.editAndSaveContact'
                                    )}
                                    containerStyle={{ paddingBottom: 12 }}
                                    secondary
                                />
                            </>
                        )}
                    </Screen>
                )}
            </>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10
    },
    contactRow: {
        flexDirection: 'row',
        marginRight: 10,
        alignItems: 'center'
    },
    contactFields: {
        fontSize: 24,
        marginBottom: 4,
        marginLeft: 4
    }
});
