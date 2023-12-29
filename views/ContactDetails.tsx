import * as React from 'react';
import {
    Text,
    View,
    Image,
    StyleSheet,
    TouchableOpacity,
    ScrollView
} from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import Screen from '../components/Screen';
import Button from '../components/Button';
import LoadingIndicator from '../components/LoadingIndicator';
import Header from '../components/Header';
import { Row } from '../components/layout/Row';

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

interface ContactDetailsProps {
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
    banner: string;
}
interface ContactDetailsState {
    contact: ContactItem;
    isLoading: boolean;
    isNostrContact: boolean;
}
export default class ContactDetails extends React.Component<
    ContactDetailsProps,
    ContactDetailsState
> {
    constructor(props: ContactDetailsProps) {
        super(props);

        this.state = {
            contact: {
                lnAddress: '',
                onchainAddress: '',
                pubkey: '',
                nip05: '',
                nostrNpub: '',
                name: '',
                description: '',
                photo: null,
                isFavourite: false,
                id: '',
                banner: ''
            },
            isLoading: true,
            isNostrContact: false
        };
    }

    async componentDidMount() {
        try {
            await this.fetchContact();

            const isNostrContact = this.props.navigation.getParam(
                'isNostrContact',
                null
            );

            this.setState({ isNostrContact });
        } catch (error) {
            console.error(error);
        }
    }

    fetchContact = async () => {
        this.props.navigation.addListener('didFocus', async () => {
            try {
                const contactId = this.props.navigation.getParam(
                    'contactId',
                    null
                );
                const nostrContact = this.props.navigation.getParam(
                    'nostrContact',
                    null
                );
                const contactsString = await EncryptedStorage.getItem(
                    'zeus-contacts'
                );

                if (contactsString && contactId) {
                    const existingContact = JSON.parse(contactsString);
                    const contact = existingContact.find(
                        (contact: ContactItem) => contact.id === contactId
                    );

                    // Store the found contact in the component's state
                    this.setState({ contact, isLoading: false });
                } else {
                    this.setState({ contact: nostrContact, isLoading: false });
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

    saveUpdatedContact = async (updatedContact: ContactItem) => {
        try {
            const contactsString = await EncryptedStorage.getItem(
                'zeus-contacts'
            );

            if (contactsString) {
                const existingContacts: ContactItem[] =
                    JSON.parse(contactsString);

                // Find the index of the contact with the same name
                const contactIndex = existingContacts.findIndex(
                    (contact) => contact.id === updatedContact.id
                );

                if (contactIndex !== -1) {
                    // Update the contact in the array
                    existingContacts[contactIndex] = updatedContact;

                    // Save the updated contacts back to storage
                    await EncryptedStorage.setItem(
                        'zeus-contacts',
                        JSON.stringify(existingContacts)
                    );

                    console.log('Contact updated successfully!');
                }
            }
        } catch (error) {
            console.log('Error updating contact:', error);
        }
    };

    importToContacts = async () => {
        const { contact } = this.state;

        const contactsString = await EncryptedStorage.getItem('zeus-contacts');

        const existingContacts: ContactItem[] = contactsString
            ? JSON.parse(contactsString)
            : [];

        const updatedContacts = [...existingContacts, contact].sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        await EncryptedStorage.setItem(
            'zeus-contacts',
            JSON.stringify(updatedContacts)
        );

        console.log('Contact imported successfully!');
        this.props.navigation.navigate('Contacts');
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
        const { contact, isLoading } = this.state;
        const { navigation } = this.props;

        const StarButton = () => (
            <TouchableOpacity onPress={this.toggleFavorite}>
                <Star
                    fill={contact.isFavourite ? themeColor('text') : 'none'}
                    stroke={contact.isFavourite ? 'none' : themeColor('text')}
                    strokeWidth={2}
                    style={{ alignSelf: 'center', marginRight: 12 }}
                />
            </TouchableOpacity>
        );

        const EditContactButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('AddContact', {
                        prefillContact: contact,
                        isEdit: true
                    })
                }
            >
                <EditContact
                    fill={themeColor('text')}
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        const QRButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('QR', {
                        value: JSON.stringify(this.state.contact),
                        hideText: true
                    })
                }
            >
                <QR fill={themeColor('text')} style={{ alignSelf: 'center' }} />
            </TouchableOpacity>
        );

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
                                !this.state.isNostrContact && (
                                    <EditContactButton />
                                )
                            }
                            rightComponent={
                                <Row>
                                    {!this.state.isNostrContact && (
                                        <StarButton />
                                    )}
                                    <QRButton />
                                </Row>
                            }
                            centerContainerStyle={{
                                paddingRight: 6,
                                marginTop: -3
                            }}
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
                                    source={{ uri: contact.banner }}
                                    style={{
                                        width: '100%',
                                        height: 150,
                                        marginBottom: 20
                                    }}
                                />
                            )}
                            {contact.photo && (
                                <Image
                                    source={{ uri: contact.photo }}
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
                                    fontSize: 44,
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
                            {contact.lnAddress &&
                                contact.lnAddress.length >= 1 &&
                                contact.lnAddress[0] !== '' && (
                                    <View>
                                        {contact.lnAddress.map(
                                            (
                                                address: string,
                                                index: number
                                            ) => (
                                                <TouchableOpacity
                                                    key={index}
                                                    onPress={() =>
                                                        this.sendAddress(
                                                            address
                                                        )
                                                    }
                                                >
                                                    <View
                                                        style={
                                                            styles.contactRow
                                                        }
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
                            {contact.pubkey &&
                                contact.pubkey.length >= 1 &&
                                contact.pubkey[0] !== '' && (
                                    <View>
                                        {contact.pubkey.map(
                                            (
                                                address: string,
                                                index: number
                                            ) => (
                                                <TouchableOpacity
                                                    key={index}
                                                    onPress={() =>
                                                        this.sendAddress(
                                                            address
                                                        )
                                                    }
                                                >
                                                    <View
                                                        key={index}
                                                        style={
                                                            styles.contactRow
                                                        }
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

                            {contact.onchainAddress &&
                                contact.onchainAddress.length >= 1 &&
                                contact.onchainAddress[0] !== '' && (
                                    <View>
                                        {contact.onchainAddress.map(
                                            (
                                                address: string,
                                                index: number
                                            ) => (
                                                <TouchableOpacity
                                                    key={index}
                                                    onPress={() =>
                                                        this.sendAddress(
                                                            address
                                                        )
                                                    }
                                                >
                                                    <View
                                                        key={index}
                                                        style={
                                                            styles.contactRow
                                                        }
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

                            {contact.nip05 &&
                                contact.nip05.length >= 1 &&
                                contact.nip05[0] !== '' && (
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
                                                        style={
                                                            styles.contactRow
                                                        }
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
                            {contact.nostrNpub &&
                                contact.nostrNpub.length >= 1 &&
                                contact.nostrNpub[0] !== '' && (
                                    <View>
                                        {contact.nostrNpub.map(
                                            (value: string, index: number) => (
                                                <TouchableOpacity
                                                    key={index}
                                                    onPress={() =>
                                                        this.handleNostr(value)
                                                    }
                                                >
                                                    <View
                                                        style={
                                                            styles.contactRow
                                                        }
                                                    >
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
                        {this.state.isNostrContact && (
                            <Button
                                onPress={() => this.importToContacts()}
                                title={localeString(
                                    'views.ContactDetails.saveToContacts'
                                )}
                                containerStyle={{ paddingBottom: 12 }}
                            />
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
