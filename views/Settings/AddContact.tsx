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
import { inject, observer } from 'mobx-react';
import { Icon, Divider } from 'react-native-elements';
import { launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import { localeString } from '../../utils/LocaleUtils';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import { Row } from '../../components/layout/Row';

import AddressUtils from '../../utils/AddressUtils';
import { getPhoto } from '../../utils/PhotoUtils';
import { themeColor } from '../../utils/ThemeUtils';

import ContactStore from '../../stores/ContactStore';

import LightningBolt from '../../assets/images/SVG/Lightning Bolt.svg';
import BitcoinIcon from '../../assets/images/SVG/BitcoinIcon.svg';
import KeySecurity from '../../assets/images/SVG/Key Security.svg';
import VerifiedAccount from '../../assets/images/SVG/Verified Account.svg';
import AddIcon from '../../assets/images/SVG/Add.svg';
import Scan from '../../assets/images/SVG/Scan.svg';
import Star from '../../assets/images/SVG/Star.svg';

interface AddContactProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'AddContact', { isEdit: boolean; isNostrContact: boolean }>;
    ContactStore: ContactStore;
}

interface StarButtonProps {
    isFavourite: boolean;
    onPress: () => void;
}

interface Contact {
    lnAddress: string[];
    bolt12Address: string[];
    bolt12Offer: string[];
    onchainAddress: string[];
    nip05: string[];
    nostrNpub: string[];
    pubkey: string[];
    name: string;
    description: string;
    contactId: string;
    photo: string | null;
    isFavourite: boolean;
}

interface AddContactState {
    contacts: Contact[];
    lnAddress: string[];
    bolt12Address: string[];
    bolt12Offer: string[];
    onchainAddress: string[];
    nip05: string[];
    nostrNpub: string[];
    pubkey: string[];
    name: string;
    description: string;
    photo: string | null;
    showExtraFieldModal: boolean;
    confirmDelete: boolean;
    isFavourite: boolean;
    isValidOnchainAddress: boolean;
    isValidLightningAddress: boolean;
    isValidBolt12Address: boolean;
    isValidBolt12Offer: boolean;
    isValidNIP05: boolean;
    isValidNpub: boolean;
    isValidPubkey: boolean;
    [key: string]: string[] | any;
}

@inject('ContactStore')
@observer
export default class AddContact extends React.Component<
    AddContactProps,
    AddContactState
> {
    constructor(props: any) {
        super(props);
        this.state = {
            contacts: [],
            lnAddress: [''],
            bolt12Address: [''],
            bolt12Offer: [''],
            onchainAddress: [''],
            nip05: [''],
            nostrNpub: [''],
            pubkey: [''],
            name: '',
            description: '',
            photo: null,
            showExtraFieldModal: false,
            confirmDelete: false,
            isFavourite: false,
            isValidOnchainAddress: true,
            isValidLightningAddress: true,
            isValidBolt12Address: true,
            isValidBolt12Offer: true,
            isValidNIP05: true,
            isValidNpub: true,
            isValidPubkey: true
        };
    }

    addExtraField = (field: string) => {
        this.setState((prevState) => ({
            [field]: [...prevState[field], '']
        }));
    };

    removeExtraField = (field: string, index: any) => {
        const updatedAddresses = [...this.state[field]];
        updatedAddresses.splice(index + 1, 1); // Remove the element at index
        this.setState({ [field]: updatedAddresses });
    };

    saveContact = async () => {
        const { navigation, route, ContactStore } = this.props;
        const { isEdit, isNostrContact } = route.params ?? {};
        const contactDetails = { ...this.state };
        await ContactStore.saveContact(
            contactDetails,
            isEdit,
            isNostrContact,
            navigation
        );
    };

    deleteContact = async () => {
        const { navigation, ContactStore } = this.props;

        await ContactStore?.deleteContact(navigation);
    };

    selectPhoto = () => {
        launchImageLibrary(
            {
                mediaType: 'photo',
                quality: 1.0,
                maxWidth: 500,
                maxHeight: 500,
                includeBase64: true
            },
            async (response: any) => {
                if (!response.didCancel) {
                    const asset = response?.assets[0];
                    if (asset.base64) {
                        // Generate a unique name for the image
                        const timestamp = new Date().getTime(); // Timestamp
                        const fileName = `photo_${timestamp}.png`;

                        const filePath =
                            RNFS.DocumentDirectoryPath + '/' + fileName;

                        try {
                            // Write the base64 data to the file
                            await RNFS.writeFile(
                                filePath,
                                asset.base64,
                                'base64'
                            );
                            console.log('File saved to ', filePath);

                            // Set the local file path in the state
                            this.setState({
                                photo: 'rnfs://' + fileName
                            });
                        } catch (error) {
                            console.error('Error saving file: ', error);
                        }
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

    onChangeBolt12Address = (text: string) => {
        const isValid = AddressUtils.isValidLightningAddress(text);
        this.setState({
            isValidBolt12Address: isValid
        });
    };

    onChangeBolt12Offer = (text: string) => {
        const isValid = AddressUtils.isValidLightningOffer(text);
        this.setState({
            isValidBolt12Offer: isValid
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

    onChangePubkey = (text: string) => {
        const isValid = AddressUtils.isValidLightningPubKey(text);
        this.setState({
            isValidPubkey: isValid
        });
    };

    toggleFavorite = () => {
        this.setState((prevState) => ({
            isFavourite: !prevState.isFavourite
        }));
    };

    componentDidMount() {
        this.handlePrefillContact();
    }

    componentDidUpdate(prevProps: AddContactProps) {
        const { ContactStore } = this.props;
        if (
            ContactStore.prefillContact !==
            prevProps.ContactStore.prefillContact
        ) {
            this.handlePrefillContact();
        }
    }

    handlePrefillContact = () => {
        const { ContactStore } = this.props;

        if (ContactStore.prefillContact) {
            this.setState({ ...ContactStore.prefillContact });
        }
    };

    render() {
        const { navigation, ContactStore } = this.props;
        const {
            lnAddress,
            bolt12Address,
            bolt12Offer,
            onchainAddress,
            nip05,
            nostrNpub,
            pubkey,
            name,
            description,
            photo,
            isValidOnchainAddress,
            isValidLightningAddress,
            isValidBolt12Address,
            isValidBolt12Offer,
            isValidNIP05,
            isValidNpub,
            isValidPubkey
        } = this.state;

        const dropdownValues = [
            {
                key: 'LN address',
                translateKey: 'general.lightningAddressCondensed',
                value: 'lnAddress'
            },
            {
                key: 'BOLT 12 address',
                translateKey: 'views.Settings.Bolt12Address',
                value: 'bolt12Address'
            },
            {
                key: 'BOLT 12 offer',
                translateKey: 'views.Settings.Bolt12Offer',
                value: 'bolt12Offer'
            },
            {
                key: 'Pubkey',
                translateKey: 'views.NodeInfo.pubkey',
                value: 'pubkey'
            },
            {
                key: 'Onchain address',
                translateKey: 'views.Settings.AddContact.onchainAddress',
                value: 'onchainAddress'
            },
            {
                key: 'NIP-05',
                translateKey: 'views.Settings.AddContact.nip05',
                value: 'nip05'
            },
            {
                key: 'Nostr npub',
                translateKey: 'views.Settings.AddContact.nostrNpub',
                value: 'nostrNpub'
            }
        ];

        const AddPhotos = () => (
            <AddIcon
                fill={themeColor('background')}
                width="30"
                height="30"
                style={{ alignSelf: 'center' }}
            />
        );

        const StarButton: React.FC<StarButtonProps> = ({
            isFavourite,
            onPress
        }) => (
            <TouchableOpacity onPress={onPress}>
                <Star
                    fill={isFavourite ? themeColor('text') : 'none'}
                    stroke={isFavourite ? 'none' : themeColor('text')}
                    strokeWidth={2}
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );
        const { isEdit } = this.props.route.params ?? {};

        const ScanBadge = ({
            navigation
        }: {
            navigation: StackNavigationProp<any, any>;
        }) => (
            <TouchableOpacity
                onPress={() => navigation.navigate('HandleAnythingQRScanner')}
                accessibilityLabel={localeString('general.scan')}
            >
                <Scan
                    fill={themeColor('text')}
                    width={30}
                    height={30}
                    style={{ marginLeft: 12 }}
                />
            </TouchableOpacity>
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
                    <Header
                        leftComponent="Back"
                        rightComponent={
                            <Row>
                                <StarButton
                                    isFavourite={this.state.isFavourite}
                                    onPress={this.toggleFavorite}
                                />
                                <ScanBadge navigation={navigation} />
                            </Row>
                        }
                        onBack={() => {
                            ContactStore?.clearPrefillContact();
                        }}
                        containerStyle={{
                            borderBottomWidth: 0
                        }}
                        navigation={navigation}
                    />
                    <ScrollView
                        contentContainerStyle={{
                            flexGrow: 1
                        }}
                    >
                        <View
                            style={{
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                        >
                            <TouchableOpacity
                                onPress={
                                    photo === null
                                        ? this.selectPhoto
                                        : () => this.setState({ photo: null })
                                }
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
                                    {photo ? (
                                        <Image
                                            source={{
                                                uri: getPhoto(photo)
                                            }}
                                            style={styles.photo}
                                        />
                                    ) : (
                                        <AddPhotos />
                                    )}
                                </View>
                            </TouchableOpacity>
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
                                style={{
                                    ...styles.textInput,
                                    color: themeColor('text')
                                }}
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
                                padding: Platform.OS === 'ios' ? 8 : 0,
                                width: '100%'
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
                                style={{
                                    ...styles.textInput,
                                    color: themeColor('text'),
                                    paddingHorizontal: 12,
                                    textAlign: 'center'
                                }}
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
                                                <Text
                                                    style={{
                                                        ...styles.modalItem,
                                                        color: themeColor(
                                                            'secondary'
                                                        )
                                                    }}
                                                >
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
                                lnAddress?.length == 1 &&
                                !isValidLightningAddress &&
                                themeColor('error')
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
                                    if (!text) {
                                        this.setState({
                                            isValidLightningAddress: true
                                        });
                                    }
                                }}
                                value={lnAddress && lnAddress[0]}
                                placeholder={localeString(
                                    'views.Settings.AddContact.lnAddress'
                                )}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
                                style={{
                                    ...styles.textInput,
                                    color: themeColor('text')
                                }}
                                autoCapitalize="none"
                            />
                        </View>
                        {lnAddress?.slice(1).map((address, index) => (
                            <>
                                <Divider
                                    orientation="horizontal"
                                    style={{ marginTop: 16 }}
                                    color={
                                        index === lnAddress?.length - 2 &&
                                        !isValidLightningAddress &&
                                        themeColor('error')
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
                                                if (!text) {
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
                                            style={{
                                                ...styles.textInput,
                                                color: themeColor('text')
                                            }}
                                            autoCapitalize="none"
                                        />
                                    </View>
                                    {isValidLightningAddress && (
                                        <TouchableOpacity
                                            style={styles.deleteIcon}
                                        >
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
                                    )}
                                </View>
                            </>
                        ))}
                        <Divider
                            orientation="horizontal"
                            style={{ marginTop: 10 }}
                            color={
                                bolt12Address?.length == 1 &&
                                (!isValidLightningAddress ||
                                    !isValidBolt12Address) &&
                                themeColor('error')
                            }
                        />

                        <View style={styles.inputContainer}>
                            <View style={styles.icons}>
                                <LightningBolt />
                            </View>
                            <TextInput
                                onChangeText={(text) => {
                                    this.onChangeBolt12Address(text);
                                    const updatedAddresses = bolt12Address
                                        ? [...bolt12Address]
                                        : [];
                                    updatedAddresses[0] = text;
                                    this.setState({
                                        bolt12Address: updatedAddresses
                                    });
                                    if (!text) {
                                        this.setState({
                                            isValidBolt12Address: true
                                        });
                                    }
                                }}
                                value={bolt12Address && bolt12Address[0]}
                                placeholder={localeString(
                                    'views.Settings.Bolt12Address'
                                )}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
                                style={{
                                    ...styles.textInput,
                                    color: themeColor('text')
                                }}
                                autoCapitalize="none"
                            />
                        </View>
                        {bolt12Address?.slice(1).map((address, index) => (
                            <>
                                <Divider
                                    orientation="horizontal"
                                    style={{ marginTop: 16 }}
                                    color={
                                        index === bolt12Address?.length - 2 &&
                                        !isValidBolt12Address &&
                                        themeColor('error')
                                    }
                                />
                                <View key={index} style={styles.inputContainer}>
                                    <View style={styles.icons}>
                                        <LightningBolt />
                                    </View>
                                    <View>
                                        <TextInput
                                            onChangeText={(text) => {
                                                this.onChangeBolt12Address(
                                                    text
                                                );
                                                const updatedAddresses = [
                                                    ...bolt12Address
                                                ];
                                                updatedAddresses[index + 1] =
                                                    text;
                                                this.setState({
                                                    bolt12Address:
                                                        updatedAddresses
                                                });
                                                if (!text) {
                                                    this.setState({
                                                        isValidBolt12Address:
                                                            true
                                                    });
                                                }
                                            }}
                                            value={address}
                                            placeholder={localeString(
                                                'views.Settings.Bolt12Address'
                                            )}
                                            placeholderTextColor={themeColor(
                                                'secondaryText'
                                            )}
                                            style={{
                                                ...styles.textInput,
                                                color: themeColor('text')
                                            }}
                                            autoCapitalize="none"
                                        />
                                    </View>
                                    {isValidBolt12Address && (
                                        <TouchableOpacity
                                            style={styles.deleteIcon}
                                        >
                                            <Icon
                                                name="close"
                                                onPress={() =>
                                                    this.removeExtraField(
                                                        'bolt12Address',
                                                        index
                                                    )
                                                }
                                                color={themeColor('text')}
                                                underlayColor="transparent"
                                                size={16}
                                            />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </>
                        ))}
                        <Divider
                            orientation="horizontal"
                            style={{ marginTop: 10 }}
                            color={
                                bolt12Offer?.length == 1 &&
                                (!isValidBolt12Address ||
                                    !isValidBolt12Offer) &&
                                themeColor('error')
                            }
                        />

                        <View style={styles.inputContainer}>
                            <View style={styles.icons}>
                                <LightningBolt />
                            </View>
                            <TextInput
                                onChangeText={(text) => {
                                    this.onChangeBolt12Offer(text);
                                    const updatedAddresses = bolt12Offer
                                        ? [...bolt12Offer]
                                        : [];
                                    updatedAddresses[0] = text;
                                    this.setState({
                                        bolt12Offer: updatedAddresses
                                    });
                                    if (!text) {
                                        this.setState({
                                            isValidBolt12Offer: true
                                        });
                                    }
                                }}
                                value={bolt12Offer && bolt12Offer[0]}
                                placeholder={localeString(
                                    'views.Settings.Bolt12Offer'
                                )}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
                                style={{
                                    ...styles.textInput,
                                    color: themeColor('text')
                                }}
                                autoCapitalize="none"
                            />
                        </View>
                        {bolt12Offer?.slice(1).map((address, index) => (
                            <>
                                <Divider
                                    orientation="horizontal"
                                    style={{ marginTop: 16 }}
                                    color={
                                        index === bolt12Offer?.length - 2 &&
                                        !isValidBolt12Offer &&
                                        themeColor('error')
                                    }
                                />
                                <View key={index} style={styles.inputContainer}>
                                    <View style={styles.icons}>
                                        <LightningBolt />
                                    </View>
                                    <View>
                                        <TextInput
                                            onChangeText={(text) => {
                                                this.onChangeBolt12Offer(text);
                                                const updatedAddresses = [
                                                    ...bolt12Offer
                                                ];
                                                updatedAddresses[index + 1] =
                                                    text;
                                                this.setState({
                                                    bolt12Offer:
                                                        updatedAddresses
                                                });
                                                if (!text) {
                                                    this.setState({
                                                        isValidBolt12Offer: true
                                                    });
                                                }
                                            }}
                                            value={address}
                                            placeholder={localeString(
                                                'views.Settings.Bolt12Offer'
                                            )}
                                            placeholderTextColor={themeColor(
                                                'secondaryText'
                                            )}
                                            style={{
                                                ...styles.textInput,
                                                color: themeColor('text')
                                            }}
                                            autoCapitalize="none"
                                        />
                                    </View>
                                    {isValidBolt12Offer && (
                                        <TouchableOpacity
                                            style={styles.deleteIcon}
                                        >
                                            <Icon
                                                name="close"
                                                onPress={() =>
                                                    this.removeExtraField(
                                                        'bolt12Offer',
                                                        index
                                                    )
                                                }
                                                color={themeColor('text')}
                                                underlayColor="transparent"
                                                size={16}
                                            />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </>
                        ))}
                        <Divider
                            orientation="horizontal"
                            style={{ marginTop: 10 }}
                            color={
                                pubkey?.length == 1 &&
                                (!isValidBolt12Offer || !isValidPubkey) &&
                                themeColor('error')
                            }
                        />

                        <View style={styles.inputContainer}>
                            <View style={styles.icons}>
                                <LightningBolt />
                            </View>
                            <TextInput
                                onChangeText={(text) => {
                                    this.onChangePubkey(text);
                                    const updatedAddresses = [...pubkey];
                                    updatedAddresses[0] = text;
                                    this.setState({
                                        pubkey: updatedAddresses
                                    });
                                    if (!text) {
                                        this.setState({
                                            isValidPubkey: true
                                        });
                                    }
                                }}
                                value={pubkey && pubkey[0]}
                                placeholder={localeString(
                                    'views.Settings.AddContact.pubkey'
                                )}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
                                numberOfLines={1}
                                style={{
                                    ...styles.textInput,
                                    color: themeColor('text')
                                }}
                                autoCapitalize="none"
                            />
                        </View>
                        {pubkey?.slice(1).map((address, index) => (
                            <>
                                <Divider
                                    orientation="horizontal"
                                    style={{ marginTop: 16 }}
                                    color={
                                        pubkey.length > 1 &&
                                        index === pubkey?.length - 2 &&
                                        (!isValidPubkey ||
                                            !isValidLightningAddress) &&
                                        themeColor('error')
                                    }
                                />
                                <View key={index} style={styles.inputContainer}>
                                    <View style={styles.icons}>
                                        <LightningBolt />
                                    </View>
                                    <View>
                                        <TextInput
                                            onChangeText={(text) => {
                                                this.onChangePubkey(text);
                                                const updatedAddresses = [
                                                    ...pubkey
                                                ];
                                                updatedAddresses[index + 1] =
                                                    text;
                                                this.setState({
                                                    pubkey: updatedAddresses
                                                });
                                                if (!text) {
                                                    this.setState({
                                                        isValidPubkey: true
                                                    });
                                                }
                                            }}
                                            value={address}
                                            placeholder={localeString(
                                                'views.Settings.AddContact.pubkey'
                                            )}
                                            placeholderTextColor={themeColor(
                                                'secondaryText'
                                            )}
                                            style={{
                                                ...styles.textInput,
                                                color: themeColor('text')
                                            }}
                                            autoCapitalize="none"
                                        />
                                    </View>
                                    {isValidPubkey && (
                                        <TouchableOpacity
                                            style={styles.deleteIcon}
                                        >
                                            <Icon
                                                name="close"
                                                onPress={() =>
                                                    this.removeExtraField(
                                                        'pubkey',
                                                        index
                                                    )
                                                }
                                                color={themeColor('text')}
                                                underlayColor="transparent"
                                                size={16}
                                            />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </>
                        ))}
                        <Divider
                            orientation="horizontal"
                            style={{
                                marginTop: 10
                            }}
                            color={
                                onchainAddress?.length == 1 &&
                                (!isValidOnchainAddress || !isValidPubkey) &&
                                themeColor('error')
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
                                    if (!text) {
                                        this.setState({
                                            isValidOnchainAddress: true
                                        });
                                    }
                                }}
                                value={onchainAddress && onchainAddress[0]}
                                placeholder={localeString(
                                    'views.Settings.AddContact.onchainAddress'
                                )}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
                                style={{
                                    ...styles.textInput,
                                    color: themeColor('text')
                                }}
                                numberOfLines={1}
                                autoCapitalize="none"
                            />
                        </View>
                        {onchainAddress?.slice(1).map((address, index) => (
                            <>
                                <Divider
                                    orientation="horizontal"
                                    style={{ marginTop: 16 }}
                                    color={
                                        index === onchainAddress?.length - 2 &&
                                        (!isValidOnchainAddress ||
                                            !isValidPubkey) &&
                                        themeColor('error')
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
                                                if (!text) {
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
                                            style={{
                                                ...styles.textInput,
                                                color: themeColor('text')
                                            }}
                                            autoCapitalize="none"
                                        />
                                    </View>
                                    {isValidOnchainAddress && (
                                        <TouchableOpacity
                                            style={styles.deleteIcon}
                                        >
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
                                    )}
                                </View>
                            </>
                        ))}
                        <Divider
                            orientation="horizontal"
                            style={{ marginTop: 10 }}
                            color={
                                nip05?.length == 1 &&
                                (!isValidOnchainAddress || !isValidNIP05) &&
                                themeColor('error')
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
                                    if (!text) {
                                        this.setState({
                                            isValidNIP05: true
                                        });
                                    }
                                }}
                                value={nip05 && nip05[0]}
                                placeholder={localeString(
                                    'views.Settings.AddContact.nip05'
                                )}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
                                numberOfLines={1}
                                style={{
                                    ...styles.textInput,
                                    color: themeColor('text')
                                }}
                                autoCapitalize="none"
                            />
                        </View>
                        {nip05?.slice(1).map((address, index) => (
                            <>
                                <Divider
                                    orientation="horizontal"
                                    style={{ marginTop: 16 }}
                                    color={
                                        index === nip05.length - 2 &&
                                        (!isValidOnchainAddress ||
                                            !isValidNIP05) &&
                                        themeColor('error')
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
                                                if (!text) {
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
                                            style={{
                                                ...styles.textInput,
                                                color: themeColor('text')
                                            }}
                                            autoCapitalize="none"
                                        />
                                    </View>
                                    {isValidNIP05 && (
                                        <TouchableOpacity
                                            style={styles.deleteIcon}
                                        >
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
                                    )}
                                </View>
                            </>
                        ))}
                        <Divider
                            orientation="horizontal"
                            style={{ marginTop: 10 }}
                            color={
                                nostrNpub?.length == 1 &&
                                (!isValidNIP05 || !isValidNpub) &&
                                themeColor('error')
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
                                    if (!text) {
                                        this.setState({
                                            isValidNpub: true
                                        });
                                    }
                                }}
                                value={nostrNpub && nostrNpub[0]}
                                placeholder={localeString(
                                    'views.Settings.AddContact.nostrNpub'
                                )}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
                                numberOfLines={1}
                                style={{
                                    ...styles.textInput,
                                    color: themeColor('text')
                                }}
                                autoCapitalize="none"
                            />
                        </View>
                        {nostrNpub?.slice(1).map((address, index) => (
                            <>
                                <Divider
                                    orientation="horizontal"
                                    style={{ marginTop: 16 }}
                                    color={
                                        index === nostrNpub?.length - 2 &&
                                        (!isValidNIP05 || !isValidNpub) &&
                                        themeColor('error')
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
                                                if (!text) {
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
                                            style={{
                                                ...styles.textInput,
                                                color: themeColor('text')
                                            }}
                                            autoCapitalize="none"
                                        />
                                    </View>
                                    {isValidNpub && (
                                        <TouchableOpacity
                                            style={styles.deleteIcon}
                                        >
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
                                    )}
                                </View>
                            </>
                        ))}
                        <Divider
                            orientation="horizontal"
                            style={{ marginTop: 10 }}
                            color={!isValidNpub && themeColor('error')}
                        />
                    </ScrollView>
                    {(lnAddress[0] || onchainAddress[0]) &&
                        isValidLightningAddress &&
                        isValidPubkey &&
                        isValidOnchainAddress &&
                        isValidNIP05 &&
                        isValidNpub && (
                            <TouchableOpacity
                                onPress={() =>
                                    this.setState({ showExtraFieldModal: true })
                                }
                                style={{
                                    alignSelf: 'center',
                                    marginTop: 10
                                }}
                            >
                                <Text
                                    style={{
                                        ...styles.addExtraFieldText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.AddContact.addExtraField'
                                    )}
                                </Text>
                            </TouchableOpacity>
                        )}

                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.Settings.AddContact.saveContact'
                            )}
                            onPress={async () => {
                                this.saveContact();
                            }}
                            containerStyle={{
                                opacity:
                                    isValidOnchainAddress &&
                                    isValidLightningAddress &&
                                    isValidBolt12Address &&
                                    isValidBolt12Offer &&
                                    isValidNIP05 &&
                                    isValidNpub &&
                                    isValidPubkey
                                        ? 1
                                        : 0.5
                            }}
                            disabled={
                                !isValidOnchainAddress ||
                                !isValidLightningAddress ||
                                !isValidBolt12Address ||
                                !isValidBolt12Offer ||
                                !isValidNIP05 ||
                                !isValidNpub ||
                                !isValidPubkey ||
                                (lnAddress?.length > 1 &&
                                    lnAddress[lnAddress.length - 1] === '') ||
                                (bolt12Address?.length > 1 &&
                                    bolt12Address[bolt12Address.length - 1] ===
                                        '') ||
                                (bolt12Offer?.length > 1 &&
                                    bolt12Offer[bolt12Offer.length - 1] ===
                                        '') ||
                                (pubkey?.length > 1 &&
                                    pubkey[pubkey.length - 1] === '') ||
                                (onchainAddress?.length > 1 &&
                                    onchainAddress[
                                        onchainAddress.length - 1
                                    ]) === '' ||
                                (nip05?.length > 1 &&
                                    nip05[nip05.length - 1] === '') ||
                                (nostrNpub?.length > 1 &&
                                    nostrNpub[nostrNpub.length - 1] === '') ||
                                !(
                                    lnAddress[0] ||
                                    bolt12Address[0] ||
                                    bolt12Offer[0] ||
                                    onchainAddress[0] ||
                                    pubkey[0]
                                )
                            }
                        />
                    </View>
                    {isEdit && ContactStore?.prefillContact && (
                        <View style={styles.button}>
                            <Button
                                title={
                                    this.state.confirmDelete
                                        ? localeString(
                                              'views.Settings.AddEditNode.tapToConfirm'
                                          )
                                        : localeString(
                                              'views.Settings.AddContact.deleteContact'
                                          )
                                }
                                onPress={() => {
                                    if (!this.state.confirmDelete) {
                                        this.setState({
                                            confirmDelete: true
                                        });
                                    } else {
                                        this.deleteContact();
                                    }
                                }}
                                warning
                            />
                        </View>
                    )}
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
        fontSize: 16
    },
    addExtraFieldText: {
        fontSize: 18,
        fontWeight: 'bold'
    },
    inputContainer: {
        paddingTop: Platform.OS === 'ios' ? 9 : 0,
        paddingBottom: Platform.OS === 'ios' ? 9 : 0,
        paddingRight: Platform.OS === 'ios' ? 9 : 0,
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
    deleteIcon: {
        position: 'absolute',
        right: 20,
        top: Platform.OS === 'ios' ? 18 : 20
    },
    textInput: {
        fontSize: 20,
        width: '100%',
        fontFamily: 'PPNeueMontreal-Book',
        top: 5
    },
    photo: {
        alignSelf: 'center',
        width: 136,
        height: 136,
        borderRadius: 68
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10,
        width: 350,
        alignSelf: 'center'
    }
});
