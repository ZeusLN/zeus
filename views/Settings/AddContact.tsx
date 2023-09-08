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
import { localeString } from '../../utils/LocaleUtils';
import Screen from '../../components/Screen';

interface AddContactProps {
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

interface AddContactState {
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

export default class AddContact extends React.Component<
    AddContactProps,
    AddContactState
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
                photo: prefillContact.photo,
                isFavourite: prefillContact.isFavourite
            });
        }
    }
    toggleFavorite = () => {
        this.setState((prevState) => ({
            isFavourite: !prevState.isFavourite
        }));
    };

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
                    navigation.navigate('Contacts', {
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

        const StarButton = ({ isFavourite, onPress }) => (
            <Icon
                name={isFavourite ? 'star' : 'star-outline'}
                onPress={onPress}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <Screen>
                <KeyboardAvoidingView
                    style={{
                        flex: 1,
                        backgroundColor: 'transparent'
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
                            rightComponent={
                                <StarButton
                                    isFavourite={this.state.isFavourite}
                                    onPress={this.toggleFavorite}
                                />
                            }
                            backgroundColor="transparent"
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
                                    backgroundColor:
                                        themeColor('secondaryText'),
                                    marginTop: 40,
                                    width: 136,
                                    height: 136,
                                    borderRadius: 68,
                                    justifyContent: 'center'
                                }}
                            >
                                {this.state.photo ? (
                                    <TouchableOpacity
                                        onPress={this.selectPhoto}
                                    >
                                        <Image
                                            source={{ uri: this.state.photo }}
                                            style={styles.photo}
                                        />
                                    </TouchableOpacity>
                                ) : (
                                    <AddPhotos />
                                )}
                            </View>
                        </View>

                        <View
                            style={{
                                alignSelf: 'center',
                                marginTop: 22,
                                padding: Platform.OS === 'ios' ? 8 : 0
                            }}
                        >
                            <TextInput
                                onChangeText={(text: string) => {
                                    this.setState({ name: text });
                                }}
                                value={name}
                                placeholder={localeString(
                                    'views.Settings.AddContact.name'
                                )}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
                                style={styles.textInput}
                                autoCapitalize="none"
                            />
                        </View>
                        <Divider
                            orientation="horizontal"
                            style={{ marginTop: 6 }}
                        />
                        <View
                            style={{
                                alignContent: 'center',
                                alignSelf: 'center',
                                padding: Platform.OS === 'ios' ? 8 : 0
                            }}
                        >
                            <TextInput
                                onChangeText={(text: string) => {
                                    this.setState({ description: text });
                                }}
                                value={description}
                                multiline
                                placeholder={localeString(
                                    'views.Settings.AddContact.description'
                                )}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
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
                                    {dropdownValues.map(
                                        (value: any, index: number) => (
                                            <TouchableOpacity
                                                key={index}
                                                onPress={() => {
                                                    this.setState({
                                                        showExtraFieldModal:
                                                            false
                                                    });
                                                    this.addExtraField(
                                                        value.value
                                                    );
                                                }}
                                            >
                                                <Text style={styles.modalItem}>
                                                    {value.key}
                                                </Text>
                                            </TouchableOpacity>
                                        )
                                    )}
                                </View>
                            </View>
                        </Modal>
                        <Divider
                            orientation="horizontal"
                            style={{
                                marginTop: 14
                            }}
                            color={
                                lnAddress.length == 1 &&
                                !isValidLightningAddress &&
                                'red'
                            }
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
                                    this.setState({
                                        lnAddress: updatedAddresses
                                    });
                                    if (text === '') {
                                        this.setState({
                                            isValidLightningAddress: true
                                        });
                                    }
                                }}
                                value={lnAddress[0]}
                                placeholder={localeString(
                                    'views.Settings.AddContact.lnAddress'
                                )}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
                                style={[styles.textInput]}
                                autoCapitalize="none"
                            />
                        </View>
                        {lnAddress.slice(1).map((address, index) => (
                            <>
                                <Divider
                                    orientation="horizontal"
                                    style={{ marginTop: 16 }}
                                    color={
                                        index === lnAddress.length - 2 &&
                                        !isValidLightningAddress &&
                                        'red'
                                    }
                                />
                                <View key={index} style={styles.inputContainer}>
                                    <View style={styles.icons}>
                                        <LightningBolt />
                                    </View>
                                    <View>
                                        <TextInput
                                            onChangeText={(text) => {
                                                this.onChangeLightningAddress(
                                                    text
                                                );
                                                const updatedAddresses = [
                                                    ...lnAddress
                                                ];
                                                updatedAddresses[index + 1] =
                                                    text;
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
                                            placeholder={localeString(
                                                'views.Settings.AddContact.lnAddress'
                                            )}
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
                                onchainAddress.length == 1 &&
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
                                    const updatedAddresses = [
                                        ...onchainAddress
                                    ];
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
                                placeholder={localeString(
                                    'views.Settings.AddContact.onchainAddress'
                                )}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
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
                                        index === onchainAddress.length - 2 &&
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
                                                this.onChangeOnchainAddress(
                                                    text
                                                );
                                                const updatedAddresses = [
                                                    ...onchainAddress
                                                ];
                                                updatedAddresses[index + 1] =
                                                    text;
                                                this.setState({
                                                    onchainAddress:
                                                        updatedAddresses
                                                });
                                                if (text === '') {
                                                    this.setState({
                                                        isValidOnchainAddress:
                                                            true
                                                    });
                                                }
                                            }}
                                            value={address}
                                            placeholder={localeString(
                                                'views.Settings.AddContact.onchainAddress'
                                            )}
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
                                nip05.length == 1 &&
                                (!isValidOnchainAddress || !isValidNIP05) &&
                                'red'
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
                                placeholder={localeString(
                                    'views.Settings.AddContact.nip05'
                                )}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
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
                                    color={
                                        index === nip05.length - 2 &&
                                        (!isValidOnchainAddress ||
                                            !isValidNIP05) &&
                                        'red'
                                    }
                                />
                                <View key={index} style={styles.inputContainer}>
                                    <View style={styles.icons}>
                                        <VerifiedAccount />
                                    </View>
                                    <View>
                                        <TextInput
                                            onChangeText={(text) => {
                                                this.onChangeNIP05(text);
                                                const updatedAddresses = [
                                                    ...nip05
                                                ];
                                                updatedAddresses[index + 1] =
                                                    text;
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
                                            placeholder={localeString(
                                                'views.Settings.AddContact.nip05'
                                            )}
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
                            color={
                                nostrNpub.length == 1 &&
                                (!isValidNIP05 || !isValidNpub) &&
                                'red'
                            }
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
                                placeholder={localeString(
                                    'views.Settings.AddContact.nostrNpub'
                                )}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
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
                                    color={
                                        index === nostrNpub.length - 2 &&
                                        (!isValidNIP05 || !isValidNpub) &&
                                        'red'
                                    }
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
                                                updatedAddresses[index + 1] =
                                                    text;
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
                                            placeholder={localeString(
                                                'views.Settings.AddContact.nostrNpub'
                                            )}
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
                    {(lnAddress[0] || onchainAddress[0]) &&
                        isValidLightningAddress &&
                        isValidOnchainAddress && (
                            <TouchableOpacity
                                onPress={() =>
                                    this.setState({ showExtraFieldModal: true })
                                }
                                style={{
                                    alignSelf: 'center',
                                    marginTop: 10
                                }}
                            >
                                <Text style={styles.addExtraFieldText}>
                                    {localeString(
                                        'views.Settings.AddContact.addExtraField'
                                    )}
                                </Text>
                            </TouchableOpacity>
                        )}

                    <View
                        style={{
                            paddingHorizontal: 20,
                            paddingVertical: 20
                        }}
                    >
                        <Button
                            title={localeString(
                                'views.Settings.AddContact.saveContact'
                            )}
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
                                (lnAddress.length > 1 &&
                                    lnAddress[lnAddress.length - 1] === '') ||
                                (onchainAddress.length > 1 &&
                                    onchainAddress[
                                        onchainAddress.length - 1
                                    ]) === '' ||
                                (nip05.length > 1 &&
                                    nip05[nip05.length - 1] === '') ||
                                (nostrNpub.length > 1 &&
                                    nostrNpub[nostrNpub.length - 1] === '') ||
                                !(lnAddress[0] || onchainAddress[0])
                            }
                        />
                    </View>
                </KeyboardAvoidingView>
            </Screen>
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
        paddingTop: Platform.OS === 'ios' ? 9 : 0,
        paddingBottom: Platform.OS === 'ios' ? 9 : 0,
        paddingRight: Platform.OS === 'ios' ? 9 : 0,
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
        top: Platform.OS === 'ios' ? 18 : 20
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
