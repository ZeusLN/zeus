import * as React from 'react';
import {
    View,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image
} from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import { Header, Icon, Divider } from 'react-native-elements';
import { launchImageLibrary } from 'react-native-image-picker';

import Scan from '../../assets/images/SVG/Scan.svg';
import Temp from '../../assets/images/SVG/Lock.svg';
import AddIcon from '../../assets/images/SVG/Add.svg';
import { themeColor } from '../../utils/ThemeUtils';
import Button from '../../components/Button';

import TextInput from '../../components/TextInput';

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
}

interface AddContactsState {
    contacts: Contact[];
    lnAddress: string;
    onchainAddress: string;
    nip05: string;
    nostrNpub: string;
    name: string;
    description: string;
    photo: string | null;
}

export default class AddContacts extends React.Component<
    AddContactsProps,
    AddContactsState
> {
    constructor(props: any) {
        super(props);
        this.state = {
            contacts: [],
            lnAddress: '',
            onchainAddress: '',
            nip05: '',
            nostrNpub: '',
            name: '',
            description: '',
            photo: null
        };
    }
    saveContact = async () => {
        const {
            lnAddress,
            onchainAddress,
            nip05,
            nostrNpub,
            name,
            description,
            photo
        } = this.state;
        try {
            // Create a new contact object
            const newContact: Contact = {
                lnAddress,
                onchainAddress,
                nip05,
                nostrNpub,
                name,
                description,
                photo
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
                lnAddress: '',
                onchainAddress: '',
                nip05: '',
                nostrNpub: '',
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
                                backgroundColor: 'white',
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
                            style={{ fontSize: 60 }}
                        />
                    </View>
                    <Divider
                        orientation="horizontal"
                        style={{ marginTop: 14 }}
                    />
                    <View style={{ alignSelf: 'center', marginTop: 14 }}>
                        <TextInput
                            onChangeText={(text: string) => {
                                this.setState({ description: text });
                            }}
                            value={description}
                            multiline
                            placeholder="Description (max 120)"
                            style={{
                                paddingHorizontal: 20,
                                marginHorizontal: 30
                            }}
                        />
                    </View>
                    <Divider
                        orientation="horizontal"
                        style={{ marginTop: 16 }}
                    />
                    <View style={styles.inputContainer}>
                        <View>
                            <Temp stroke={themeColor('text')} />
                        </View>
                        <TextInput
                            onChangeText={(text: string) => {
                                this.setState({ lnAddress: text });
                            }}
                            value={lnAddress}
                            placeholder="LN address"
                            style={styles.inputField}
                        />
                    </View>
                    <Divider
                        orientation="horizontal"
                        style={{ marginTop: 10 }}
                    />
                    <View style={styles.inputContainer}>
                        <View>
                            <Temp stroke={themeColor('text')} />
                        </View>
                        <TextInput
                            onChangeText={(text: string) => {
                                this.setState({ onchainAddress: text });
                            }}
                            value={onchainAddress}
                            placeholder="Onchain address"
                            numberOfLines={1}
                            style={styles.inputField}
                        />
                    </View>
                    <Divider
                        orientation="horizontal"
                        style={{ marginTop: 10 }}
                    />
                    <View style={styles.inputContainer}>
                        <View>
                            <Temp stroke={themeColor('text')} />
                        </View>
                        <TextInput
                            onChangeText={(text: string) => {
                                this.setState({ nip05: text });
                            }}
                            value={nip05}
                            placeholder="NIP 05"
                            style={styles.inputField}
                        />
                    </View>
                    <Divider
                        orientation="horizontal"
                        style={{ marginTop: 10 }}
                    />
                    <View style={styles.inputContainer}>
                        <View>
                            <Temp stroke={themeColor('text')} />
                        </View>
                        <TextInput
                            onChangeText={(text: string) => {
                                this.setState({ nostrNpub: text });
                            }}
                            value={nostrNpub}
                            placeholder="Nostr npub"
                            style={styles.inputField}
                        />
                    </View>
                    <Divider
                        orientation="horizontal"
                        style={{ marginTop: 10 }}
                    />
                    <Button
                        title="Save Contact"
                        buttonStyle={{ padding: 14 }}
                        onPress={async () => {
                            this.saveContact();
                        }}
                        containerStyle={{
                            bottom: -110
                        }}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        );
    }
}

const styles = StyleSheet.create({
    inputContainer: {
        marginTop: 4,
        marginLeft: 14,
        flexDirection: 'row',
        alignItems: 'center'
    },
    inputField: {
        marginLeft: 8
    },
    photo: {
        alignSelf: 'center',
        width: 136,
        height: 136,
        borderRadius: 68
    }
});
