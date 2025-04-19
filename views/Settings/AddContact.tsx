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
import Ecash from '../../assets/images/SVG/Ecash.svg';
import BitcoinIcon from '../../assets/images/SVG/BitcoinIcon.svg';
import KeySecurity from '../../assets/images/SVG/Key Security.svg';
import VerifiedAccount from '../../assets/images/SVG/Verified Account.svg';
import AddIcon from '../../assets/images/SVG/Add.svg';
import Scan from '../../assets/images/SVG/Scan.svg';
import Star from '../../assets/images/SVG/Star.svg';

interface ContactInputFieldProps {
    icon: React.ReactNode;
    value: string;
    onChangeText: (text: string) => void;
    onValidate: (text: string) => void;
    placeholder: string;
    isValid: boolean;
    index: number;
    setValidationState: (index: number, isValid: boolean) => void;
    isAdditionalField?: boolean;
    onDelete?: () => void;
}

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
    cashuPubkey: string[];
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
    cashuPubkey: string[];
    name: string;
    description: string;
    photo: string | null;
    showExtraFieldModal: boolean;
    confirmDelete: boolean;
    isFavourite: boolean;
    isValidLightningAddress: boolean[];
    isValidBolt12Address: boolean[];
    isValidBolt12Offer: boolean[];
    isValidPubkey: boolean[];
    isValidCashuPubkey: boolean[];
    isValidOnchainAddress: boolean[];
    isValidNIP05: boolean[];
    isValidNpub: boolean[];
    [key: string]: string[] | any;
}

const ContactInputField = ({
    icon,
    value,
    onChangeText,
    onValidate,
    placeholder,
    isValid,
    index,
    setValidationState,
    isAdditionalField,
    onDelete
}: ContactInputFieldProps) => (
    <>
        <View style={styles.inputContainer}>
            <View style={styles.icons}>{icon}</View>
            <TextInput
                onChangeText={(text) => {
                    onChangeText(text);
                    onValidate(text);
                    if (!text) {
                        setValidationState(index, true);
                    } else {
                        onValidate(text);
                    }
                }}
                value={value}
                placeholder={placeholder}
                placeholderTextColor={themeColor('secondaryText')}
                style={{
                    ...styles.textInput,
                    color: isValid ? themeColor('text') : themeColor('error')
                }}
                autoCapitalize="none"
            />
            {isAdditionalField && (
                <TouchableOpacity style={styles.deleteIcon}>
                    <Icon
                        name="close"
                        onPress={onDelete}
                        color={themeColor('text')}
                        underlayColor="transparent"
                        size={16}
                    />
                </TouchableOpacity>
            )}
        </View>
        <Divider orientation="horizontal" style={{ marginTop: 10 }} />
    </>
);

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
            cashuPubkey: [''],
            name: '',
            description: '',
            photo: null,
            showExtraFieldModal: false,
            confirmDelete: false,
            isFavourite: false,
            isValidLightningAddress: [true],
            isValidBolt12Address: [true],
            isValidBolt12Offer: [true],
            isValidPubkey: [true],
            isValidOnchainAddress: [true],
            isValidNIP05: [true],
            isValidNpub: [true],
            isValidCashuPubkey: [true]
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

    onChangeLightningAddress = (text: string, index: number) => {
        const isValid =
            AddressUtils.isValidLightningPaymentRequest(text) ||
            AddressUtils.isValidLightningAddress(text) ||
            AddressUtils.isValidBitcoinAddress(text, true);

        this.setState((prevState) => ({
            isValidLightningAddress: Object.assign(
                [...prevState.isValidLightningAddress],
                {
                    [index]: isValid
                }
            )
        }));
    };

    onChangeBolt12Address = (text: string, index: number) => {
        const isValid = AddressUtils.isValidLightningAddress(text);

        this.setState((prevState) => ({
            isValidBolt12Address: Object.assign(
                [...prevState.isValidBolt12Address],
                {
                    [index]: isValid
                }
            )
        }));
    };

    onChangeBolt12Offer = (text: string, index: number) => {
        const isValid = AddressUtils.isValidLightningOffer(text);

        this.setState((prevState) => ({
            isValidBolt12Offer: Object.assign(
                [...prevState.isValidBolt12Offer],
                {
                    [index]: isValid
                }
            )
        }));
    };

    onChangePubkey = (text: string, index: number) => {
        const isValid = AddressUtils.isValidLightningPubKey(text);

        this.setState((prevState) => ({
            isValidPubkey: Object.assign([...prevState.isValidPubkey], {
                [index]: isValid
            })
        }));
    };

    onChangeOnchainAddress = (text: string, index: number) => {
        const isValid = AddressUtils.isValidBitcoinAddress(text, true); // Pass true for testnet

        this.setState((prevState) => ({
            isValidOnchainAddress: Object.assign(
                [...prevState.isValidOnchainAddress],
                {
                    [index]: isValid
                }
            )
        }));
    };

    onChangeNIP05 = (text: string, index: number) => {
        const isValid = AddressUtils.isValidLightningAddress(text);

        this.setState((prevState) => ({
            isValidNIP05: Object.assign([...prevState.isValidNIP05], {
                [index]: isValid
            })
        }));
    };

    onChangeNpub = (text: string, index: number) => {
        const isValid = AddressUtils.isValidNpub(text);

        this.setState((prevState) => ({
            isValidNpub: Object.assign([...prevState.isValidNpub], {
                [index]: isValid
            })
        }));
    };

    onChangeCashuPubkey = (text: string, index: number) => {
        const { cashuPubkey } = this.state;
        console.log('text', cashuPubkey);
        this.setState({
            cashuPubkey: Object.assign([...cashuPubkey], { [index]: text }),
            isValidCashuPubkey: Object.assign(
                [...this.state.isValidCashuPubkey],
                {
                    [index]: text.length === 66 && text.startsWith('02')
                }
            )
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
            // Since invalid data cannot be saved, we know all existing fields are valid.
            // Array length matches the number of fields for each type, defaulting to 1 for empty arrays.
            const validationStates = {
                isValidLightningAddress: Array(
                    ContactStore.prefillContact.lnAddress?.length || 1
                ).fill(true),
                isValidBolt12Address: Array(
                    ContactStore.prefillContact.bolt12Address?.length || 1
                ).fill(true),
                isValidBolt12Offer: Array(
                    ContactStore.prefillContact.bolt12Offer?.length || 1
                ).fill(true),
                isValidPubkey: Array(
                    ContactStore.prefillContact.pubkey?.length || 1
                ).fill(true),
                isValidCashuPubkey: Array(
                    ContactStore.prefillContact.cashuPubkey?.length || 1
                ).fill(true),
                isValidOnchainAddress: Array(
                    ContactStore.prefillContact.onchainAddress?.length || 1
                ).fill(true),
                isValidNIP05: Array(
                    ContactStore.prefillContact.nip05?.length || 1
                ).fill(true),
                isValidNpub: Array(
                    ContactStore.prefillContact.nostrNpub?.length || 1
                ).fill(true)
            };

            this.setState({
                ...ContactStore.prefillContact,
                ...validationStates
            });
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
            cashuPubkey,
            name,
            description,
            photo,
            isValidOnchainAddress,
            isValidLightningAddress,
            isValidBolt12Address,
            isValidBolt12Offer,
            isValidNIP05,
            isValidNpub,
            isValidPubkey,
            isValidCashuPubkey
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
                key: 'Cashu Pubkey',
                translateKey: 'views.Settings.AddContact.cashuPubkey',
                value: 'cashuPubkey'
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
                        />

                        <ContactInputField
                            icon={<LightningBolt />}
                            value={lnAddress?.length ? lnAddress[0] : ''}
                            onChangeText={(text) => {
                                this.setState({
                                    lnAddress: Object.assign([...lnAddress], {
                                        [0]: text
                                    })
                                });
                            }}
                            onValidate={(text) =>
                                this.onChangeLightningAddress(text, 0)
                            }
                            placeholder={localeString(
                                'views.Settings.AddContact.lnAddress'
                            )}
                            isValid={
                                isValidLightningAddress?.length > 0 &&
                                isValidLightningAddress[0]
                            }
                            index={0}
                            setValidationState={(index, isValid) => {
                                this.setState({
                                    isValidLightningAddress: Object.assign(
                                        [...this.state.isValidLightningAddress],
                                        { [index]: isValid }
                                    )
                                });
                            }}
                        />
                        {lnAddress?.slice(1).map((address, index) => (
                            <ContactInputField
                                key={index}
                                icon={<LightningBolt />}
                                value={address}
                                onChangeText={(text) => {
                                    this.setState({
                                        lnAddress: Object.assign(
                                            [...lnAddress],
                                            { [index + 1]: text }
                                        )
                                    });
                                }}
                                onValidate={(text) =>
                                    this.onChangeLightningAddress(
                                        text,
                                        index + 1
                                    )
                                }
                                placeholder={localeString(
                                    'views.Settings.AddContact.lnAddress'
                                )}
                                isValid={isValidLightningAddress[index + 1]}
                                index={index + 1}
                                setValidationState={(index, isValid) => {
                                    this.setState({
                                        isValidLightningAddress: Object.assign(
                                            [
                                                ...this.state
                                                    .isValidLightningAddress
                                            ],
                                            { [index]: isValid }
                                        )
                                    });
                                }}
                                isAdditionalField
                                onDelete={() =>
                                    this.removeExtraField('lnAddress', index)
                                }
                            />
                        ))}

                        <ContactInputField
                            icon={<LightningBolt />}
                            value={
                                bolt12Address?.length ? bolt12Address[0] : ''
                            }
                            onChangeText={(text) => {
                                this.setState({
                                    bolt12Address: Object.assign(
                                        [...bolt12Address],
                                        {
                                            [0]: text
                                        }
                                    )
                                });
                            }}
                            onValidate={(text) =>
                                this.onChangeBolt12Address(text, 0)
                            }
                            placeholder={localeString(
                                'views.Settings.Bolt12Address'
                            )}
                            isValid={
                                isValidBolt12Address?.length > 0 &&
                                isValidBolt12Address[0]
                            }
                            index={0}
                            setValidationState={(index, isValid) => {
                                this.setState({
                                    isValidBolt12Address: Object.assign(
                                        [...this.state.isValidBolt12Address],
                                        { [index]: isValid }
                                    )
                                });
                            }}
                        />
                        {bolt12Address?.slice(1).map((address, index) => (
                            <ContactInputField
                                key={index}
                                icon={<LightningBolt />}
                                value={address}
                                onChangeText={(text) => {
                                    this.setState({
                                        bolt12Address: Object.assign(
                                            [...bolt12Address],
                                            { [index + 1]: text }
                                        )
                                    });
                                }}
                                onValidate={(text) =>
                                    this.onChangeBolt12Address(text, index + 1)
                                }
                                placeholder={localeString(
                                    'views.Settings.Bolt12Address'
                                )}
                                isValid={isValidBolt12Address[index + 1]}
                                index={index + 1}
                                setValidationState={(index, isValid) => {
                                    this.setState({
                                        isValidBolt12Address: Object.assign(
                                            [
                                                ...this.state
                                                    .isValidBolt12Address
                                            ],
                                            { [index]: isValid }
                                        )
                                    });
                                }}
                                isAdditionalField
                                onDelete={() =>
                                    this.removeExtraField(
                                        'bolt12Address',
                                        index
                                    )
                                }
                            />
                        ))}

                        <ContactInputField
                            icon={<LightningBolt />}
                            value={bolt12Offer?.length ? bolt12Offer[0] : ''}
                            onChangeText={(text) => {
                                this.setState({
                                    bolt12Offer: Object.assign(
                                        [...bolt12Offer],
                                        {
                                            [0]: text
                                        }
                                    )
                                });
                            }}
                            onValidate={(text) =>
                                this.onChangeBolt12Offer(text, 0)
                            }
                            placeholder={localeString(
                                'views.Settings.Bolt12Offer'
                            )}
                            isValid={
                                isValidBolt12Offer?.length > 0 &&
                                isValidBolt12Offer[0]
                            }
                            index={0}
                            setValidationState={(index, isValid) => {
                                this.setState({
                                    isValidBolt12Offer: Object.assign(
                                        [...this.state.isValidBolt12Offer],
                                        { [index]: isValid }
                                    )
                                });
                            }}
                        />
                        {bolt12Offer?.slice(1).map((address, index) => (
                            <ContactInputField
                                key={index}
                                icon={<LightningBolt />}
                                value={address}
                                onChangeText={(text) => {
                                    this.setState({
                                        bolt12Offer: Object.assign(
                                            [...bolt12Offer],
                                            { [index + 1]: text }
                                        )
                                    });
                                }}
                                onValidate={(text) =>
                                    this.onChangeBolt12Offer(text, index + 1)
                                }
                                placeholder={localeString(
                                    'views.Settings.Bolt12Offer'
                                )}
                                isValid={isValidBolt12Offer[index + 1]}
                                index={index + 1}
                                setValidationState={(index, isValid) => {
                                    this.setState({
                                        isValidBolt12Offer: Object.assign(
                                            [...this.state.isValidBolt12Offer],
                                            { [index]: isValid }
                                        )
                                    });
                                }}
                                isAdditionalField
                                onDelete={() =>
                                    this.removeExtraField('bolt12Offer', index)
                                }
                            />
                        ))}

                        <ContactInputField
                            icon={<LightningBolt />}
                            value={pubkey?.length ? pubkey[0] : ''}
                            onChangeText={(text) => {
                                this.setState({
                                    pubkey: Object.assign([...pubkey], {
                                        [0]: text
                                    })
                                });
                            }}
                            onValidate={(text) => this.onChangePubkey(text, 0)}
                            placeholder={localeString(
                                'views.Settings.AddContact.pubkey'
                            )}
                            isValid={
                                isValidPubkey?.length > 0 && isValidPubkey[0]
                            }
                            index={0}
                            setValidationState={(index, isValid) => {
                                this.setState({
                                    isValidPubkey: Object.assign(
                                        [...this.state.isValidPubkey],
                                        { [index]: isValid }
                                    )
                                });
                            }}
                        />
                        {pubkey?.slice(1).map((address, index) => (
                            <ContactInputField
                                key={index}
                                icon={<LightningBolt />}
                                value={address}
                                onChangeText={(text) => {
                                    this.setState({
                                        pubkey: Object.assign([...pubkey], {
                                            [index + 1]: text
                                        })
                                    });
                                }}
                                onValidate={(text) =>
                                    this.onChangePubkey(text, index + 1)
                                }
                                placeholder={localeString(
                                    'views.Settings.AddContact.pubkey'
                                )}
                                isValid={isValidPubkey[index + 1]}
                                index={index + 1}
                                setValidationState={(index, isValid) => {
                                    this.setState({
                                        isValidPubkey: Object.assign(
                                            [...this.state.isValidPubkey],
                                            { [index]: isValid }
                                        )
                                    });
                                }}
                                isAdditionalField
                                onDelete={() =>
                                    this.removeExtraField('pubkey', index)
                                }
                            />
                        ))}
                        <ContactInputField
                            icon={<Ecash />}
                            value={cashuPubkey?.length ? cashuPubkey[0] : ''}
                            onChangeText={(text) => {
                                this.setState({
                                    cashuPubkey: Object.assign(
                                        [...cashuPubkey],
                                        {
                                            [0]: text
                                        }
                                    )
                                });
                            }}
                            onValidate={(text) =>
                                this.onChangeCashuPubkey(text, 0)
                            }
                            placeholder={localeString(
                                'views.Settings.AddContact.cashuPubkey'
                            )}
                            isValid={
                                isValidCashuPubkey?.length > 0 &&
                                isValidCashuPubkey[0]
                            }
                            index={0}
                            setValidationState={(index, isValid) => {
                                this.setState({
                                    isValidCashuPubkey: Object.assign(
                                        [...this.state.isValidCashuPubkey],
                                        { [index]: isValid }
                                    )
                                });
                            }}
                        />
                        {cashuPubkey?.slice(1).map((address, index) => (
                            <ContactInputField
                                key={index}
                                icon={<Ecash />}
                                value={address}
                                onChangeText={(text) => {
                                    this.setState({
                                        cashuPubkey: Object.assign(
                                            [...cashuPubkey],
                                            {
                                                [index + 1]: text
                                            }
                                        )
                                    });
                                }}
                                onValidate={(text) =>
                                    this.onChangeCashuPubkey(text, index + 1)
                                }
                                placeholder={localeString(
                                    'views.Settings.AddContact.cashuPubkey'
                                )}
                                isValid={isValidCashuPubkey[index + 1]}
                                index={index + 1}
                                setValidationState={(index, isValid) => {
                                    this.setState({
                                        isValidCashuPubkey: Object.assign(
                                            [...this.state.isValidCashuPubkey],
                                            { [index]: isValid }
                                        )
                                    });
                                }}
                                isAdditionalField
                                onDelete={() =>
                                    this.removeExtraField('cashuPubkey', index)
                                }
                            />
                        ))}

                        <ContactInputField
                            icon={<BitcoinIcon />}
                            value={
                                onchainAddress?.length ? onchainAddress[0] : ''
                            }
                            onChangeText={(text) => {
                                this.setState({
                                    onchainAddress: Object.assign(
                                        [...onchainAddress],
                                        {
                                            [0]: text
                                        }
                                    )
                                });
                            }}
                            onValidate={(text) =>
                                this.onChangeOnchainAddress(text, 0)
                            }
                            placeholder={localeString(
                                'views.Settings.AddContact.onchainAddress'
                            )}
                            isValid={
                                isValidOnchainAddress?.length > 0 &&
                                isValidOnchainAddress[0]
                            }
                            index={0}
                            setValidationState={(index, isValid) => {
                                this.setState({
                                    isValidOnchainAddress: Object.assign(
                                        [...this.state.isValidOnchainAddress],
                                        { [index]: isValid }
                                    )
                                });
                            }}
                        />
                        {onchainAddress?.slice(1).map((address, index) => (
                            <ContactInputField
                                key={index}
                                icon={<BitcoinIcon />}
                                value={address}
                                onChangeText={(text) => {
                                    this.setState({
                                        onchainAddress: Object.assign(
                                            [...onchainAddress],
                                            { [index + 1]: text }
                                        )
                                    });
                                }}
                                onValidate={(text) =>
                                    this.onChangeOnchainAddress(text, index + 1)
                                }
                                placeholder={localeString(
                                    'views.Settings.AddContact.onchainAddress'
                                )}
                                isValid={isValidOnchainAddress[index + 1]}
                                index={index + 1}
                                setValidationState={(index, isValid) => {
                                    this.setState({
                                        isValidOnchainAddress: Object.assign(
                                            [
                                                ...this.state
                                                    .isValidOnchainAddress
                                            ],
                                            { [index]: isValid }
                                        )
                                    });
                                }}
                                isAdditionalField
                                onDelete={() =>
                                    this.removeExtraField(
                                        'onchainAddress',
                                        index
                                    )
                                }
                            />
                        ))}

                        <ContactInputField
                            icon={<VerifiedAccount />}
                            value={nip05?.length ? nip05[0] : ''}
                            onChangeText={(text) => {
                                this.setState({
                                    nip05: Object.assign([...nip05], {
                                        [0]: text
                                    })
                                });
                            }}
                            onValidate={(text) => this.onChangeNIP05(text, 0)}
                            placeholder={localeString(
                                'views.Settings.AddContact.nip05'
                            )}
                            isValid={
                                isValidNIP05?.length > 0 && isValidNIP05[0]
                            }
                            index={0}
                            setValidationState={(index, isValid) => {
                                this.setState({
                                    isValidNIP05: Object.assign(
                                        [...this.state.isValidNIP05],
                                        { [index]: isValid }
                                    )
                                });
                            }}
                        />
                        {nip05?.slice(1).map((address, index) => (
                            <ContactInputField
                                key={index}
                                icon={<VerifiedAccount />}
                                value={address}
                                onChangeText={(text) => {
                                    this.setState({
                                        nip05: Object.assign([...nip05], {
                                            [index + 1]: text
                                        })
                                    });
                                }}
                                onValidate={(text) =>
                                    this.onChangeNIP05(text, index + 1)
                                }
                                placeholder={localeString(
                                    'views.Settings.AddContact.nip05'
                                )}
                                isValid={isValidNIP05[index + 1]}
                                index={index + 1}
                                setValidationState={(index, isValid) => {
                                    this.setState({
                                        isValidNIP05: Object.assign(
                                            [...this.state.isValidNIP05],
                                            { [index]: isValid }
                                        )
                                    });
                                }}
                                isAdditionalField
                                onDelete={() =>
                                    this.removeExtraField('nip05', index)
                                }
                            />
                        ))}

                        <ContactInputField
                            icon={<KeySecurity />}
                            value={nostrNpub?.length ? nostrNpub[0] : ''}
                            onChangeText={(text) => {
                                this.setState({
                                    nostrNpub: Object.assign([...nostrNpub], {
                                        [0]: text
                                    })
                                });
                            }}
                            onValidate={(text) => this.onChangeNpub(text, 0)}
                            placeholder={localeString(
                                'views.Settings.AddContact.nostrNpub'
                            )}
                            isValid={isValidNpub?.length > 0 && isValidNpub[0]}
                            index={0}
                            setValidationState={(index, isValid) => {
                                this.setState({
                                    isValidNpub: Object.assign(
                                        [...this.state.isValidNpub],
                                        { [index]: isValid }
                                    )
                                });
                            }}
                        />
                        {nostrNpub?.slice(1).map((address, index) => (
                            <ContactInputField
                                key={index}
                                icon={<KeySecurity />}
                                value={address}
                                onChangeText={(text) => {
                                    this.setState({
                                        nostrNpub: Object.assign(
                                            [...nostrNpub],
                                            { [index + 1]: text }
                                        )
                                    });
                                }}
                                onValidate={(text) =>
                                    this.onChangeNpub(text, index + 1)
                                }
                                placeholder={localeString(
                                    'views.Settings.AddContact.nostrNpub'
                                )}
                                isValid={isValidNpub[index + 1]}
                                index={index + 1}
                                setValidationState={(index, isValid) => {
                                    this.setState({
                                        isValidNpub: Object.assign(
                                            [...this.state.isValidNpub],
                                            { [index]: isValid }
                                        )
                                    });
                                }}
                                isAdditionalField
                                onDelete={() =>
                                    this.removeExtraField('nostrNpub', index)
                                }
                            />
                        ))}
                    </ScrollView>
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
                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.Settings.AddContact.saveContact'
                            )}
                            onPress={async () => {
                                this.saveContact();
                            }}
                            disabled={
                                isValidLightningAddress.includes(false) ||
                                isValidBolt12Address.includes(false) ||
                                isValidBolt12Offer.includes(false) ||
                                isValidPubkey.includes(false) ||
                                isValidOnchainAddress.includes(false) ||
                                isValidNIP05.includes(false) ||
                                isValidNpub.includes(false) ||
                                isValidCashuPubkey.includes(false) ||
                                !(
                                    (lnAddress?.length && lnAddress[0]) ||
                                    (bolt12Address?.length &&
                                        bolt12Address[0]) ||
                                    (bolt12Offer?.length && bolt12Offer[0]) ||
                                    (onchainAddress?.length &&
                                        onchainAddress[0]) ||
                                    (pubkey?.length && pubkey[0]) ||
                                    (cashuPubkey?.length && cashuPubkey[0])
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
        marginHorizontal: 24,
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
