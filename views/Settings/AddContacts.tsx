import * as React from 'react';
import {
    View,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
    Modal,
    Text,
    TextInput
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import EncryptedStorage from 'react-native-encrypted-storage';
import { Header, Icon, Divider } from 'react-native-elements';
import { launchImageLibrary } from 'react-native-image-picker';

import LightningBolt from '../../assets/images/SVG/Lightning Bolt.svg';
import BitcoinIcon from '../../assets/images/SVG/BitcoinIcon.svg';
import KeySecurity from '../../assets/images/SVG/Key Security.svg';
import VerifiedAccount from '../../assets/images/SVG/Verified Account.svg';
import AddIcon from '../../assets/images/SVG/Add.svg';
import { themeColor } from '../../utils/ThemeUtils';
import AddressUtils from '../../utils/AddressUtils';

import Button from '../../components/Button';

interface AddContactsProps {
    navigation: any;
}

interface Contact {
    lnAddress: string;
    onchainAddress: string;
    nip05: string;
    nostrNpub: string;
    name: string;
    description: string;
    photo: string | null;
    isFavourite: boolean;
}

interface AddContactsState {
    contacts: Contact[];
    lnAddress: string[];
    onchainAddress: string[];
    nip05: string[];
    nostrNpub: string[];
    name: string;
    description: string;
    photo: string | null;
    showExtraFieldModal: boolean;
    isFavourite: boolean;
    isValidOnchainAddress: boolean;
    isValidLightningAddress: boolean;
    isValidNIP05: boolean;
    isValidNpub: boolean;
}

export default class AddContacts extends React.Component<
    AddContactsProps,
    AddContactsState
> {
    constructor(props: any) {
        super(props);
        this.state = {
            contacts: [],
            lnAddress: [''],
            onchainAddress: [''],
            nip05: [''],
            nostrNpub: [''],
            name: '',
            description: '',
            photo: null,
            showExtraFieldModal: false,
            isFavourite: false,
            isValidOnchainAddress: true,
            isValidLightningAddress: true,
            isValidNIP05: true,
            isValidNpub: true
        };
    }

    addExtraField = (field: string) => {
        this.setState((prevState) => ({
            [field]: [...prevState[field], '']
        }));
    };
    removeExtraField = (field, index) => {
        const updatedAddresses = [...this.state[field]];
        updatedAddresses.splice(index + 1, 1); // Remove the element at index
        this.setState({ [field]: updatedAddresses });
    };

    saveContact = async () => {
        const {
            lnAddress,
            onchainAddress,
            nip05,
            nostrNpub,
            name,
            description,
            photo,
            isFavourite
        } = this.state;

        const isEdit = !!this.props.navigation.getParam('isEdit', false);
        const prefillContact = this.props.navigation.getParam(
            'prefillContact',
            null
        );

        try {
            // Retrieve existing contacts from storage
            const contactsString = await EncryptedStorage.getItem(
                'zeus-contacts'
            );
            const existingContacts: Contact[] = contactsString
                ? JSON.parse(contactsString)
                : [];

            if (isEdit && prefillContact) {
                // Editing an existing contact
                const updatedContacts = existingContacts.map((contact) =>
                    contact.id === prefillContact.id
                        ? {
                              ...contact,
                              lnAddress,
                              onchainAddress,
                              nip05,
                              nostrNpub,
                              name,
                              description,
                              photo,
                              isFavourite
                          }
                        : contact
                );

                // Sort the updated contacts alphabetically
                updatedContacts.sort((a, b) => a.name.localeCompare(b.name));

                // Save the updated contacts to encrypted storage
                await EncryptedStorage.setItem(
                    'zeus-contacts',
                    JSON.stringify(updatedContacts)
                );

                console.log('Contact updated successfully!');
                this.props.navigation.goBack();
            } else {
                // Creating a new contact
                const contactId = uuidv4();

                const newContact: Contact = {
                    id: contactId,
                    lnAddress,
                    onchainAddress,
                    nip05,
                    nostrNpub,
                    name,
                    description,
                    photo,
                    isFavourite
                };

                const updatedContacts = [...existingContacts, newContact].sort(
                    (a, b) => a.name.localeCompare(b.name)
                );

                // Save the updated contacts to encrypted storage
                await EncryptedStorage.setItem(
                    'zeus-contacts',
                    JSON.stringify(updatedContacts)
                );

                console.log('Contact saved successfully!');
                this.props.navigation.goBack();

                // Reset the input fields after saving the contact
                this.setState({
                    contacts: updatedContacts,
                    lnAddress: [],
                    onchainAddress: [],
                    nip05: [],
                    nostrNpub: [],
                    name: '',
                    description: '',
                    photo: null
                });
            }
        } catch (error) {
            console.log('Error saving contacts:', error);
        }
    };

    selectPhoto = () => {
        launchImageLibrary(
            {
                title: 'Select Photo',
                mediaType: 'photo',
                quality: 1.0,
                maxWidth: 500,
                maxHeight: 500
            },
            (response) => {
                if (!response.didCancel) {
                    const asset = response.assets[0];
                    if (asset.uri) {
                        this.setState({ photo: asset.uri });
                    }
                }
            }
        );
    };

    onChangeOnchainAddress = (text: string) => {
        const isValid = AddressUtils.isValidBitcoinAddress(text, true); // Pass true for testnet
        this.setState({
            isValidOnchainAddress: isValid
        });
    };
    onChangeLightningAddress = (text: string) => {
        const isValid =
            AddressUtils.isValidLightningPaymentRequest(text) ||
            AddressUtils.isValidLightningAddress(text) ||
            AddressUtils.isValidBitcoinAddress(text, true);
        this.setState({
            isValidLightningAddress: isValid
        });
    };
    onChangeNIP05 = (text: string) => {
        const isValid = AddressUtils.isValidLightningAddress(text);
        this.setState({
            isValidNIP05: isValid
        });
    };
    onChangeNpub = (text: string) => {
        const isValid = AddressUtils.isValidNpub(text);
        this.setState({
            isValidNpub: isValid
        });
    };

    componentDidMount() {
        const prefillContact = this.props.navigation.getParam(
            'prefillContact',
            null
        );
        if (prefillContact) {
            this.setState({
                lnAddress: prefillContact.lnAddress,
                onchainAddress: prefillContact.onchainAddress,
                nip05: prefillContact.nip05,
                nostrNpub: prefillContact.nostrNpub,
                name: prefillContact.name,
                description: prefillContact.description,
                photo: prefillContact.photo
            });
        }
    }

    render() {
        const { navigation } = this.props;
        const {
            lnAddress,
            onchainAddress,
            nip05,
            nostrNpub,
            name,
            description,
            isValidOnchainAddress,
            isValidLightningAddress,
            isValidNIP05,
            isValidNpub
        } = this.state;
        const dropdownValues = [
            { key: 'LN address', translateKey: '', value: 'lnAddress' },
            {
                key: 'Onchain address',
                translateKey: '',
                value: 'onchainAddress'
            },
            { key: 'NIP-05', translateKey: '', value: 'nip05' },
            { key: 'Nostr npub', translateKey: '', value: 'nostrNpub' }
        ];

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => {
                    navigation.navigate('ContactsSettings', {
                        refresh: true
                    });
                }}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );
        const AddPhotos = () => (
            <TouchableOpacity onPress={this.selectPhoto}>
                <AddIcon
                    fill={themeColor('background')}
                    width="20"
                    height="20"
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        return (
            <KeyboardAvoidingView
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={{
                        flexGrow: 1
                    }}
                >
                    <Header
                        leftComponent={<BackButton />}
                        backgroundColor={themeColor('background')}
                        containerStyle={{
                            borderBottomWidth: 0
                        }}
                    />
                    <View
                        style={{
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                    >
                        <View
                            style={{
                                backgroundColor: themeColor('secondaryText'),
                                marginTop: 40,
                                width: 136,
                                height: 136,
                                borderRadius: 68,
                                justifyContent: 'center'
                            }}
                        >
                            {this.state.photo ? (
                                <Image
                                    source={{ uri: this.state.photo }}
                                    style={styles.photo}
                                />
                            ) : (
                                <AddPhotos />
                            )}
                        </View>
                    </View>

                    <View
                        style={{
                            alignSelf: 'center',
                            marginTop: 22
                        }}
                    >
                        <TextInput
                            onChangeText={(text: string) => {
                                this.setState({ name: text });
                            }}
                            value={name}
                            placeholder="Name*"
                            placeholderTextColor={themeColor('secondaryText')}
                            style={styles.textInput}
                            autoCapitalize="none"
                        />
                    </View>
                    <Divider
                        orientation="horizontal"
                        style={{ marginTop: 6 }}
                    />
                    <View
                        style={{ alignContent: 'center', alignSelf: 'center' }}
                    >
                        <TextInput
                            onChangeText={(text: string) => {
                                this.setState({ description: text });
                            }}
                            value={description}
                            multiline
                            placeholder="Description (max 120)"
                            placeholderTextColor={themeColor('secondaryText')}
                            style={styles.textInput}
                            autoCapitalize="none"
                        />
                    </View>
                    <Modal
                        animationType="slide"
                        transparent={true}
                        visible={this.state.showExtraFieldModal}
                        onRequestClose={() =>
                            this.setState({ showExtraFieldModal: false })
                        }
                    >
                        <View style={styles.modalContainer}>
                            <View style={styles.modalCenter}>
                                {dropdownValues.map((value, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        onPress={() => {
                                            this.setState({
                                                showExtraFieldModal: false
                                            });
                                            this.addExtraField(value.value);
                                        }}
                                    >
                                        <Text style={styles.modalItem}>
                                            {value.key}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </Modal>
                    <Divider
                        orientation="horizontal"
                        style={{
                            marginTop: 14
                        }}
                        color={!isValidLightningAddress && 'red'}
                    />
                    <View style={styles.inputContainer}>
                        <View style={styles.icons}>
                            <LightningBolt />
                        </View>
                        <TextInput
                            onChangeText={(text) => {
                                this.onChangeLightningAddress(text);
                                const updatedAddresses = [...lnAddress];
                                updatedAddresses[0] = text;
                                this.setState({ lnAddress: updatedAddresses });
                                if (text === '') {
                                    this.setState({
                                        isValidLightningAddress: true
                                    });
                                }
                            }}
                            value={lnAddress[0]}
                            placeholder="LN address"
                            placeholderTextColor={themeColor('secondaryText')}
                            style={[styles.textInput]}
                            autoCapitalize="none"
                        />
                    </View>
                    {lnAddress.slice(1).map((address, index) => (
                        <>
                            <Divider
                                orientation="horizontal"
                                style={{ marginTop: 16 }}
                                color={!isValidLightningAddress && 'red'}
                            />
                            <View key={index} style={styles.inputContainer}>
                                <View style={styles.icons}>
                                    <LightningBolt />
                                </View>
                                <View>
                                    <TextInput
                                        onChangeText={(text) => {
                                            this.onChangeLightningAddress(text);
                                            const updatedAddresses = [
                                                ...lnAddress
                                            ];
                                            updatedAddresses[index + 1] = text;
                                            this.setState({
                                                lnAddress: updatedAddresses
                                            });
                                            if (text === '') {
                                                this.setState({
                                                    isValidLightningAddress:
                                                        true
                                                });
                                            }
                                        }}
                                        value={address}
                                        placeholder="LN address"
                                        placeholderTextColor={themeColor(
                                            'secondaryText'
                                        )}
                                        style={styles.textInput}
                                        autoCapitalize="none"
                                    />
                                </View>
                                <TouchableOpacity style={styles.deleteIcon}>
                                    <Icon
                                        name="close"
                                        onPress={() =>
                                            this.removeExtraField(
                                                'lnAddress',
                                                index
                                            )
                                        }
                                        color={themeColor('text')}
                                        underlayColor="transparent"
                                        size={16}
                                    />
                                </TouchableOpacity>
                            </View>
                        </>
                    ))}
                    <Divider
                        orientation="horizontal"
                        style={{
                            marginTop: 10
                        }}
                        color={
                            (!isValidOnchainAddress ||
                                !isValidLightningAddress) &&
                            'red'
                        }
                    />
                    <View style={styles.inputContainer}>
                        <View style={styles.icons}>
                            <BitcoinIcon />
                        </View>
                        <TextInput
                            onChangeText={(text) => {
                                this.onChangeOnchainAddress(text);
                                const updatedAddresses = [...onchainAddress];
                                updatedAddresses[0] = text;
                                this.setState({
                                    onchainAddress: updatedAddresses
                                });
                                if (text === '') {
                                    this.setState({
                                        isValidOnchainAddress: true
                                    });
                                }
                            }}
                            value={onchainAddress[0]}
                            placeholder="Onchain address"
                            placeholderTextColor={themeColor('secondaryText')}
                            style={[styles.textInput]}
                            numberOfLines={1}
                            autoCapitalize="none"
                        />
                    </View>
                    {onchainAddress.slice(1).map((address, index) => (
                        <>
                            <Divider
                                orientation="horizontal"
                                style={{ marginTop: 16 }}
                                color={
                                    (!isValidOnchainAddress ||
                                        !isValidLightningAddress) &&
                                    'red'
                                }
                            />
                            <View key={index} style={styles.inputContainer}>
                                <View style={styles.icons}>
                                    <BitcoinIcon />
                                </View>
                                <View>
                                    <TextInput
                                        onChangeText={(text) => {
                                            this.onChangeOnchainAddress(text);
                                            const updatedAddresses = [
                                                ...onchainAddress
                                            ];
                                            updatedAddresses[index + 1] = text;
                                            this.setState({
                                                onchainAddress: updatedAddresses
                                            });
                                            if (text === '') {
                                                this.setState({
                                                    isValidOnchainAddress: true
                                                });
                                            }
                                        }}
                                        value={address}
                                        placeholder="Onchain address"
                                        placeholderTextColor={themeColor(
                                            'secondaryText'
                                        )}
                                        style={styles.textInput}
                                        autoCapitalize="none"
                                    />
                                </View>
                                <TouchableOpacity style={styles.deleteIcon}>
                                    <Icon
                                        name="close"
                                        onPress={() =>
                                            this.removeExtraField(
                                                'onchainAddress',
                                                index
                                            )
                                        }
                                        color={themeColor('text')}
                                        underlayColor="transparent"
                                        size={16}
                                    />
                                </TouchableOpacity>
                            </View>
                        </>
                    ))}
                    <Divider
                        orientation="horizontal"
                        style={{ marginTop: 10 }}
                        color={
                            (!isValidOnchainAddress || !isValidNIP05) && 'red'
                        }
                    />
                    <View style={styles.inputContainer}>
                        <View style={styles.icons}>
                            <VerifiedAccount />
                        </View>
                        <TextInput
                            onChangeText={(text) => {
                                this.onChangeNIP05(text);
                                const updatedAddresses = [...nip05];
                                updatedAddresses[0] = text;
                                this.setState({
                                    nip05: updatedAddresses
                                });
                                if (text === '') {
                                    this.setState({
                                        isValidNIP05: true
                                    });
                                }
                            }}
                            value={nip05[0]}
                            placeholder="NIP-05"
                            placeholderTextColor={themeColor('secondaryText')}
                            numberOfLines={1}
                            style={styles.textInput}
                            autoCapitalize="none"
                        />
                    </View>
                    {nip05.slice(1).map((address, index) => (
                        <>
                            <Divider
                                orientation="horizontal"
                                style={{ marginTop: 16 }}
                            />
                            <View key={index} style={styles.inputContainer}>
                                <View style={styles.icons}>
                                    <VerifiedAccount />
                                </View>
                                <View>
                                    <TextInput
                                        onChangeText={(text) => {
                                            this.onChangeNIP05(text);
                                            const updatedAddresses = [...nip05];
                                            updatedAddresses[index + 1] = text;
                                            this.setState({
                                                nip05: updatedAddresses
                                            });
                                            if (text === '') {
                                                this.setState({
                                                    isValidNIP05: true
                                                });
                                            }
                                        }}
                                        value={address}
                                        placeholder="NIP-05"
                                        placeholderTextColor={themeColor(
                                            'secondaryText'
                                        )}
                                        style={styles.textInput}
                                        autoCapitalize="none"
                                    />
                                </View>
                                <TouchableOpacity style={styles.deleteIcon}>
                                    <Icon
                                        name="close"
                                        onPress={() =>
                                            this.removeExtraField(
                                                'nip05',
                                                index
                                            )
                                        }
                                        color={themeColor('text')}
                                        underlayColor="transparent"
                                        size={16}
                                    />
                                </TouchableOpacity>
                            </View>
                        </>
                    ))}
                    <Divider
                        orientation="horizontal"
                        style={{ marginTop: 10 }}
                        color={(!isValidNIP05 || !isValidNpub) && 'red'}
                    />
                    <View style={styles.inputContainer}>
                        <View style={styles.icons}>
                            <KeySecurity />
                        </View>
                        <TextInput
                            onChangeText={(text) => {
                                this.onChangeNpub(text);
                                const updatedAddresses = [...nostrNpub];
                                updatedAddresses[0] = text;
                                this.setState({
                                    nostrNpub: updatedAddresses
                                });
                                if (text === '') {
                                    this.setState({
                                        isValidNpub: true
                                    });
                                }
                            }}
                            value={nostrNpub[0]}
                            placeholder="Nostr npub"
                            placeholderTextColor={themeColor('secondaryText')}
                            numberOfLines={1}
                            style={styles.textInput}
                            autoCapitalize="none"
                        />
                    </View>
                    {nostrNpub.slice(1).map((address, index) => (
                        <>
                            <Divider
                                orientation="horizontal"
                                style={{ marginTop: 16 }}
                            />
                            <View key={index} style={styles.inputContainer}>
                                <View style={styles.icons}>
                                    <KeySecurity />
                                </View>
                                <View>
                                    <TextInput
                                        onChangeText={(text) => {
                                            this.onChangeNpub(text);
                                            const updatedAddresses = [
                                                ...nostrNpub
                                            ];
                                            updatedAddresses[index + 1] = text;
                                            this.setState({
                                                nostrNpub: updatedAddresses
                                            });
                                            if (text === '') {
                                                this.setState({
                                                    isValidNpub: true
                                                });
                                            }
                                        }}
                                        value={address}
                                        placeholder="Nostr npub"
                                        placeholderTextColor={themeColor(
                                            'secondaryText'
                                        )}
                                        style={styles.textInput}
                                        autoCapitalize="none"
                                    />
                                </View>
                                <TouchableOpacity style={styles.deleteIcon}>
                                    <Icon
                                        name="close"
                                        onPress={() =>
                                            this.removeExtraField(
                                                'nostrNpub',
                                                index
                                            )
                                        }
                                        color={themeColor('text')}
                                        underlayColor="transparent"
                                        size={16}
                                    />
                                </TouchableOpacity>
                            </View>
                        </>
                    ))}
                    <Divider
                        orientation="horizontal"
                        style={{ marginTop: 10 }}
                        color={!isValidNpub && 'red'}
                    />
                </ScrollView>
                {(lnAddress[0] || onchainAddress[0]) && (
                    <TouchableOpacity
                        onPress={() =>
                            this.setState({ showExtraFieldModal: true })
                        }
                        style={{
                            alignSelf: 'center',
                            marginTop: 10,
                            marginBottom: 20
                        }}
                    >
                        <Text style={styles.addExtraFieldText}>
                            add extra field
                        </Text>
                    </TouchableOpacity>
                )}

                <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
                    <Button
                        title="Save Contact"
                        buttonStyle={{ padding: 14 }}
                        onPress={async () => {
                            this.saveContact();
                        }}
                        containerStyle={{
                            opacity:
                                isValidOnchainAddress &&
                                isValidLightningAddress &&
                                isValidNIP05 &&
                                isValidNpub
                                    ? 1
                                    : 0.5
                        }}
                        disabled={
                            !isValidOnchainAddress ||
                            !isValidLightningAddress ||
                            !isValidNIP05 ||
                            !isValidNpub ||
                            !(lnAddress[0] || onchainAddress[0])
                        }
                    />
                </View>
            </KeyboardAvoidingView>
        );
    }
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalCenter: {
        width: '80%',
        backgroundColor: 'white',
        padding: 14
    },
    modalItem: {
        paddingVertical: 10,
        fontSize: 16,
        color: themeColor('secondary')
    },
    addExtraFieldText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: themeColor('text')
    },
    inputContainer: {
        marginLeft: 24,
        flexDirection: 'row',
        alignItems: 'center'
    },
    invalidInput: {
        color: 'red'
    },
    icons: {
        paddingRight: 14,
        top: 4,
        width: 26,
        height: 26,
        alignItems: 'center',
        justifyContent: 'center'
    },
    deleteIcon: {
        position: 'absolute',
        right: 20,
        top: 20
    },
    textInput: {
        fontSize: 20,
        width: '100%',
        fontFamily: 'Lato-Regular',
        top: 5,
        color: themeColor('text')
    },
    photo: {
        alignSelf: 'center',
        width: 136,
        height: 136,
        borderRadius: 68
    }
});
