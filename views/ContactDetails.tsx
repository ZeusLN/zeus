import * as React from 'react';
import {
    Text,
    View,
    Image,
    StyleSheet,
    TouchableOpacity,
    Modal
} from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import { Header, Icon, Divider } from 'react-native-elements';
import Button from '../components/Button';
import Screen from '../components/Screen';

import LightningBolt from '../assets/images/SVG/Lightning Bolt.svg';
import BitcoinIcon from '../assets/images/SVG/BitcoinIcon.svg';
import KeySecurity from '../assets/images/SVG/Key Security.svg';
import VerifiedAccount from '../assets/images/SVG/Verified Account.svg';
import EditContact from '../assets/images/SVG/Pen.svg';

import { themeColor } from '../utils/ThemeUtils';

interface ContactDetailsProps {
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
    id: string;
}
interface ContactDetailsState {
    contact: ContactItem;
    isModalVisible: boolean;
}
export default class ContactDetails extends React.Component<
    ContactDetailsProps,
    ContactDetailsState
> {
    constructor(props: ContactDetailsProps) {
        super(props);
        const contact: ContactItem = this.props.navigation.getParam(
            'contact',
            null
        );

        this.state = {
            contact,
            isModalVisible: false
        };
    }
    toggleModal = () => {
        this.setState((prevState) => ({
            isModalVisible: !prevState.isModalVisible
        }));
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

    render() {
        const { contact, isModalVisible } = this.state;
        const { navigation } = this.props;
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
        const StarButton = () => (
            <Icon
                name={contact.isFavourite ? 'star' : 'star-outline'}
                onPress={this.toggleFavorite}
                color={themeColor('text')}
                underlayColor="transparent"
                size={28}
            />
        );
        const EditContactButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('AddContacts', {
                        prefillContact: contact,
                        isEdit: true
                    })
                }
            >
                <EditContact height={36} width={36} />
            </TouchableOpacity>
        );
        return (
            <Screen>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={<EditContactButton />}
                    rightComponent={<StarButton />}
                    centerContainerStyle={{ paddingRight: 6, marginTop: -3 }}
                    placement="right"
                    backgroundColor="none"
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <View
                    style={{
                        backgroundColor: 'none',
                        alignItems: 'center',
                        marginTop: 60
                    }}
                >
                    {contact.photo && (
                        <Image
                            source={{ uri: contact.photo }}
                            style={{
                                width: 150,
                                height: 150,
                                borderRadius: 75,
                                marginBottom: 20
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
                            color: themeColor('secondaryText')
                        }}
                    >
                        {contact.description}
                    </Text>
                    <Modal
                        transparent={true}
                        animationType="slide"
                        visible={isModalVisible}
                    >
                        <View style={styles.centeredView}>
                            <View
                                style={{
                                    ...styles.modal,
                                    backgroundColor: themeColor('background')
                                }}
                            >
                                {isModalVisible && (
                                    <>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor('text'),
                                                fontSize: 25
                                            }}
                                        >
                                            Select address to use
                                        </Text>

                                        {contact.lnAddress &&
                                            contact.lnAddress.length > 0 &&
                                            contact.lnAddress[0] !== '' && (
                                                <>
                                                    {contact.lnAddress.map(
                                                        (address, index) => (
                                                            <TouchableOpacity
                                                                key={index}
                                                                onPress={() => {
                                                                    this.sendAddress(
                                                                        address
                                                                    );
                                                                    this.setState(
                                                                        {
                                                                            isModalVisible:
                                                                                false
                                                                        }
                                                                    );
                                                                }}
                                                            >
                                                                {address !==
                                                                    contact
                                                                        .lnAddress[0] && (
                                                                    <Divider
                                                                        orientation="horizontal"
                                                                        style={{
                                                                            marginTop: 20
                                                                        }}
                                                                    />
                                                                )}

                                                                {contact
                                                                    .lnAddress
                                                                    .length >
                                                                    0 && (
                                                                    <Text
                                                                        style={{
                                                                            color: themeColor(
                                                                                'text'
                                                                            ),
                                                                            fontSize: 16,
                                                                            fontWeight:
                                                                                'bold',
                                                                            marginTop: 12,
                                                                            marginBottom: 4
                                                                        }}
                                                                    >
                                                                        Lightning
                                                                        Address:
                                                                    </Text>
                                                                )}
                                                                <Text
                                                                    style={{
                                                                        color: themeColor(
                                                                            'text'
                                                                        )
                                                                    }}
                                                                >
                                                                    {address.length >
                                                                    15
                                                                        ? address.substr(
                                                                              0,
                                                                              15
                                                                          ) +
                                                                          '...' +
                                                                          address.substr(
                                                                              address.length -
                                                                                  15
                                                                          )
                                                                        : address}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        )
                                                    )}
                                                </>
                                            )}

                                        {contact.onchainAddress &&
                                            contact.onchainAddress.length > 0 &&
                                            contact.onchainAddress[0] !==
                                                '' && (
                                                <>
                                                    {contact.onchainAddress.map(
                                                        (address, index) => (
                                                            <TouchableOpacity
                                                                key={index}
                                                                onPress={() => {
                                                                    this.sendAddress(
                                                                        address
                                                                    );
                                                                    this.setState(
                                                                        {
                                                                            isModalVisible:
                                                                                false
                                                                        }
                                                                    );
                                                                }}
                                                            >
                                                                {(contact
                                                                    .lnAddress[0] !==
                                                                    '' ||
                                                                    address !==
                                                                        contact
                                                                            .onchainAddress[0]) && (
                                                                    <Divider
                                                                        orientation="horizontal"
                                                                        style={{
                                                                            marginTop: 20
                                                                        }}
                                                                    />
                                                                )}
                                                                {contact
                                                                    .onchainAddress
                                                                    .length >
                                                                    0 && (
                                                                    <Text
                                                                        style={{
                                                                            color: themeColor(
                                                                                'text'
                                                                            ),
                                                                            fontSize: 16,
                                                                            fontWeight:
                                                                                'bold',
                                                                            marginTop: 12,
                                                                            marginBottom: 4
                                                                        }}
                                                                    >
                                                                        On-chain
                                                                        Address:
                                                                    </Text>
                                                                )}
                                                                <Text
                                                                    style={{
                                                                        color: themeColor(
                                                                            'text'
                                                                        )
                                                                    }}
                                                                >
                                                                    {address.length >
                                                                    15
                                                                        ? address.substr(
                                                                              0,
                                                                              15
                                                                          ) +
                                                                          '...' +
                                                                          address.substr(
                                                                              address.length -
                                                                                  15
                                                                          )
                                                                        : address}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        )
                                                    )}
                                                </>
                                            )}
                                        <View
                                            style={{
                                                ...styles.button,
                                                marginTop: 14
                                            }}
                                        >
                                            <Button
                                                title="CANCEL"
                                                onPress={() =>
                                                    this.setState({
                                                        isModalVisible: false
                                                    })
                                                }
                                                secondary
                                            />
                                        </View>
                                    </>
                                )}
                            </View>
                        </View>
                    </Modal>

                    {contact.lnAddress[0] && (
                        <View>
                            <View style={styles.contactRow}>
                                <LightningBolt />
                                <Text style={styles.contactFields}>
                                    {contact.lnAddress[0].length > 15
                                        ? `${contact.lnAddress[0].substring(
                                              0,
                                              10
                                          )}...${contact.lnAddress[0].substring(
                                              contact.lnAddress[0].length - 5
                                          )}`
                                        : contact.lnAddress[0]}
                                </Text>
                            </View>
                        </View>
                    )}
                    {contact.onchainAddress[0] && (
                        <View style={styles.contactRow}>
                            <BitcoinIcon />
                            <Text style={styles.contactFields}>
                                {contact.onchainAddress[0].length > 15
                                    ? `${contact.onchainAddress[0].substring(
                                          0,
                                          10
                                      )}...${contact.onchainAddress[0].substring(
                                          contact.onchainAddress[0].length - 5
                                      )}`
                                    : contact.onchainAddress[0]}
                            </Text>
                        </View>
                    )}
                    {contact.nip05[0] && (
                        <View style={styles.contactRow}>
                            <VerifiedAccount />
                            <Text style={styles.contactFields}>
                                {contact.nip05[0].length > 15
                                    ? `${contact.nip05[0].substring(
                                          0,
                                          10
                                      )}...${contact.nip05[0].substring(
                                          contact.nip05[0].length - 5
                                      )}`
                                    : contact.nip05[0]}
                            </Text>
                        </View>
                    )}
                    {contact.nostrNpub[0] && (
                        <View style={styles.contactRow}>
                            <View>
                                <KeySecurity />
                            </View>
                            <Text style={styles.contactFields}>
                                {contact.nostrNpub[0].length > 15
                                    ? `${contact.nostrNpub[0].substring(
                                          0,
                                          10
                                      )}...${contact.nostrNpub[0].substring(
                                          contact.nostrNpub[0].length - 5
                                      )}`
                                    : contact.nostrNpub[0]}
                            </Text>
                        </View>
                    )}
                </View>
                <Button
                    containerStyle={{ position: 'absolute', bottom: 30 }}
                    buttonStyle={{ padding: 18 }}
                    title="MAKE PAYMENT"
                    onPress={() => {
                        if (
                            contact.lnAddress.length === 1 &&
                            contact.lnAddress[0] !== '' &&
                            contact.onchainAddress[0] === ''
                        )
                            this.sendAddress(contact.lnAddress[0]);
                        else if (
                            contact.onchainAddress.length === 1 &&
                            contact.onchainAddress[0] !== '' &&
                            contact.lnAddress[0] === ''
                        ) {
                            this.sendAddress(contact.onchainAddress[0]);
                        } else {
                            this.toggleModal();
                        }
                    }}
                />
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 22
    },
    modal: {
        margin: 20,
        borderRadius: 20,
        padding: 35,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5
    },
    text: {
        fontFamily: 'Lato-Regular'
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10
    },
    contactFields: {
        fontSize: 20,
        marginBottom: 4,
        marginLeft: 4,
        color: themeColor('chain')
    }
});
