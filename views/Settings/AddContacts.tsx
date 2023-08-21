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

import Scan from '../../assets/images/SVG/Scan.svg';
import LightningBolt from '../../assets/images/SVG/Lightning Bolt.svg';
import BitcoinIcon from '../../assets/images/SVG/BitcoinIcon.svg';
import KeySecurity from '../../assets/images/SVG/Key Security.svg';
import VerifiedAccount from '../../assets/images/SVG/Verified Account.svg';
import AddIcon from '../../assets/images/SVG/Add.svg';
import { themeColor } from '../../utils/ThemeUtils';
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
            isFavourite: false
        };
    }

    addExtraField = (field: string) => {
        this.setState((prevState) => ({
            [field]: [...prevState[field], '']
        }));
    };

    saveContact = async () => {
        // await EncryptedStorage.clear();
        const contactId = uuidv4();
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
        try {
            // Create a new contact object
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

            // Retrieve existing contacts from storage
            const contactsString = await EncryptedStorage.getItem(
                'zeus-contacts'
            );
            const existingContacts: Contact[] = contactsString
                ? JSON.parse(contactsString)
                : [];

            // Update the contacts array by adding the new contact
            const updatedContacts = [...existingContacts, newContact];

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

    render() {
        const { navigation } = this.props;
        const {
            lnAddress,
            onchainAddress,
            nip05,
            nostrNpub,
            name,
            description
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
        const ScanBadge = ({ navigation }: { navigation: any }) => (
            <TouchableOpacity onPress={() => navigation.navigate('')}>
                <Scan fill={themeColor('text')} />
            </TouchableOpacity>
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
                        rightComponent={
                            <View style={{ marginTop: 1 }}>
                                <ScanBadge navigation={navigation} />
                            </View>
                        }
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
                        style={{ marginTop: 14 }}
                    />
                    <View style={styles.inputContainer}>
                        <View style={styles.icons}>
                            <LightningBolt />
                        </View>
                        <TextInput
                            onChangeText={(text) => {
                                const updatedAddresses = [...lnAddress];
                                updatedAddresses[0] = text;
                                this.setState({ lnAddress: updatedAddresses });
                            }}
                            value={lnAddress[0]}
                            placeholder="LN address"
                            placeholderTextColor={themeColor('secondaryText')}
                            style={styles.textInput}
                        />
                    </View>
                    {lnAddress.slice(1).map((address, index) => (
                        <>
                            <Divider
                                orientation="horizontal"
                                style={{ marginTop: 16 }}
                            />
                            <View key={index} style={styles.inputContainer}>
                                <View style={styles.icons}>
                                    <LightningBolt />
                                </View>
                                <View>
                                    <TextInput
                                        onChangeText={(text) => {
                                            const updatedAddresses = [
                                                ...lnAddress
                                            ];
                                            updatedAddresses[index + 1] = text;
                                            this.setState({
                                                lnAddress: updatedAddresses
                                            });
                                        }}
                                        value={address}
                                        placeholder="LN address"
                                        placeholderTextColor={themeColor(
                                            'secondaryText'
                                        )}
                                        style={styles.textInput}
                                    />
                                </View>
                            </View>
                        </>
                    ))}
                    <Divider
                        orientation="horizontal"
                        style={{ marginTop: 10 }}
                    />
                    <View style={styles.inputContainer}>
                        <View style={styles.icons}>
                            <BitcoinIcon />
                        </View>
                        <TextInput
                            onChangeText={(text) => {
                                const updatedAddresses = [...onchainAddress];
                                updatedAddresses[0] = text;
                                this.setState({
                                    onchainAddress: updatedAddresses
                                });
                            }}
                            value={onchainAddress[0]}
                            placeholder="Onchain address"
                            placeholderTextColor={themeColor('secondaryText')}
                            style={styles.textInput}
                            numberOfLines={1}
                        />
                    </View>
                    {onchainAddress.slice(1).map((address, index) => (
                        <>
                            <Divider
                                orientation="horizontal"
                                style={{ marginTop: 16 }}
                            />
                            <View key={index} style={styles.inputContainer}>
                                <View style={styles.icons}>
                                    <BitcoinIcon />
                                </View>
                                <View>
                                    <TextInput
                                        onChangeText={(text) => {
                                            const updatedAddresses = [
                                                ...onchainAddress
                                            ];
                                            updatedAddresses[index + 1] = text;
                                            this.setState({
                                                onchainAddress: updatedAddresses
                                            });
                                        }}
                                        value={address}
                                        placeholder="Onchain address"
                                        placeholderTextColor={themeColor(
                                            'secondaryText'
                                        )}
                                        style={styles.textInput}
                                    />
                                </View>
                            </View>
                        </>
                    ))}
                    <Divider
                        orientation="horizontal"
                        style={{ marginTop: 10 }}
                    />
                    <View style={styles.inputContainer}>
                        <View style={styles.icons}>
                            <VerifiedAccount />
                        </View>
                        <TextInput
                            onChangeText={(text) => {
                                const updatedAddresses = [...nip05];
                                updatedAddresses[0] = text;
                                this.setState({
                                    nip05: updatedAddresses
                                });
                            }}
                            value={nip05[0]}
                            placeholder="NIP-05"
                            placeholderTextColor={themeColor('secondaryText')}
                            numberOfLines={1}
                            style={styles.textInput}
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
                                            const updatedAddresses = [...nip05];
                                            updatedAddresses[index + 1] = text;
                                            this.setState({
                                                nip05: updatedAddresses
                                            });
                                        }}
                                        value={address}
                                        placeholder="NIP-05"
                                        placeholderTextColor={themeColor(
                                            'secondaryText'
                                        )}
                                        style={styles.textInput}
                                    />
                                </View>
                            </View>
                        </>
                    ))}
                    <Divider
                        orientation="horizontal"
                        style={{ marginTop: 10 }}
                    />
                    <View style={styles.inputContainer}>
                        <View style={styles.icons}>
                            <KeySecurity />
                        </View>
                        <TextInput
                            onChangeText={(text) => {
                                const updatedAddresses = [...nostrNpub];
                                updatedAddresses[0] = text;
                                this.setState({
                                    nostrNpub: updatedAddresses
                                });
                            }}
                            value={nostrNpub[0]}
                            placeholder="Nostr npub"
                            placeholderTextColor={themeColor('secondaryText')}
                            numberOfLines={1}
                            style={styles.textInput}
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
                                            const updatedAddresses = [
                                                ...nostrNpub
                                            ];
                                            updatedAddresses[index + 1] = text;
                                            this.setState({
                                                nostrNpub: updatedAddresses
                                            });
                                        }}
                                        value={address}
                                        placeholder="Nostr npub"
                                        placeholderTextColor={themeColor(
                                            'secondaryText'
                                        )}
                                        style={styles.textInput}
                                    />
                                </View>
                            </View>
                        </>
                    ))}
                    <Divider
                        orientation="horizontal"
                        style={{ marginTop: 10 }}
                    />
                    <TouchableOpacity
                        onPress={() =>
                            this.setState({ showExtraFieldModal: true })
                        }
                        style={{
                            alignSelf: 'center',
                            marginTop: 30,
                            marginBottom: 20
                        }}
                    >
                        <Text style={styles.addExtraFieldText}>
                            add extra field
                        </Text>
                    </TouchableOpacity>
                    <Button
                        title="Save Contact"
                        buttonStyle={{ padding: 14 }}
                        onPress={async () => {
                            this.saveContact();
                        }}
                        containerStyle={{
                            bottom: 0
                        }}
                    />
                </ScrollView>
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
    icons: {
        paddingRight: 14,
        top: 4,
        width: 26,
        height: 26,
        alignItems: 'center',
        justifyContent: 'center'
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
