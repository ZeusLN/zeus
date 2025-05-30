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
import CashuIcon from '../../assets/images/SVG/Ecash.svg';
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
    showFieldModal: boolean;
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
    isAdditionalField = false,
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
                style={[
                    styles.fieldInput,
                    {
                        color: isValid
                            ? themeColor('text')
                            : themeColor('error')
                    }
                ]}
                autoCapitalize="none"
            />
            {isAdditionalField && (
                <TouchableOpacity style={styles.icons} onPress={onDelete}>
                    <Icon
                        name="close"
                        color={themeColor('text')}
                        underlayColor="transparent"
                        size={18}
                    />
                </TouchableOpacity>
            )}
        </View>
        <Divider style={styles.divider} />
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
            lnAddress: [],
            bolt12Address: [],
            bolt12Offer: [],
            onchainAddress: [],
            nip05: [],
            nostrNpub: [],
            pubkey: [],
            cashuPubkey: [],
            name: '',
            description: '',
            photo: null,
            showFieldModal: false,
            confirmDelete: false,
            isFavourite: false,
            isValidLightningAddress: [],
            isValidBolt12Address: [],
            isValidBolt12Offer: [],
            isValidPubkey: [],
            isValidCashuPubkey: [],
            isValidOnchainAddress: [],
            isValidNIP05: [],
            isValidNpub: []
        };
    }

    addField = (field: string) => {
        this.setState((prevState) => {
            // Add new empty field
            const updatedFields = [...(prevState[field] || []), ''];

            // Add corresponding validation state
            const validationKey = `isValid${
                field.charAt(0).toUpperCase() + field.slice(1)
            }`;
            const updatedValidation = [
                ...(prevState[validationKey] || []),
                true
            ];

            return {
                [field]: updatedFields,
                [validationKey]: updatedValidation,
                showFieldModal: false
            };
        });
    };

    removeField = (field: string, index: number) => {
        this.setState((prevState) => {
            const updatedFields = [...prevState[field]];
            updatedFields.splice(index, 1);

            const validationKey = `isValid${
                field.charAt(0).toUpperCase() + field.slice(1)
            }`;

            const updatedValidation = prevState[validationKey]
                ? [...prevState[validationKey]]
                : [];

            if (updatedValidation.length > 0) {
                updatedValidation.splice(index, 1);
            }

            return {
                [field]: updatedFields,
                [validationKey]: updatedValidation
            };
        });
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
        // For the default Lightning Address field (index 0), maintain invalid state when emptied
        const isValid =
            index === 0
                ? text
                    ? AddressUtils.isValidLightningPaymentRequest(text) ||
                      AddressUtils.isValidLightningAddress(text) ||
                      AddressUtils.isValidBitcoinAddress(text, true)
                    : this.state.lnAddress[0] === '' // Only valid if it was never touched
                : text
                ? AddressUtils.isValidLightningPaymentRequest(text) ||
                  AddressUtils.isValidLightningAddress(text) ||
                  AddressUtils.isValidBitcoinAddress(text, true)
                : true; // Additional fields can be empty

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

    onChangeCashuPubkey = (text: string, index: number) => {
        const isValid = AddressUtils.isValidLightningPubKey(text);

        this.setState((prevState) => ({
            isValidCashuPubkey: Object.assign(
                [...prevState.isValidCashuPubkey],
                {
                    [index]: isValid
                }
            )
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

    toggleFavorite = () => {
        this.setState((prevState) => ({
            isFavourite: !prevState.isFavourite
        }));
    };

    componentDidMount() {
        // Initialize with one empty Lightning Address field
        this.setState({
            lnAddress: [''],
            isValidLightningAddress: [true]
        });
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
    renderAddedFields = () => {
        const allFields: JSX.Element[] = [];
        allFields.push(
            <ContactInputField
                key="default-ln-address"
                icon={<LightningBolt />}
                value={this.state.lnAddress[0] || ''}
                onChangeText={(text) => {
                    const updatedFields = [...this.state.lnAddress];
                    updatedFields[0] = text;
                    this.setState({ lnAddress: updatedFields });
                }}
                onValidate={(text) => {
                    const isValid = text
                        ? AddressUtils.isValidLightningPaymentRequest(text) ||
                          AddressUtils.isValidLightningAddress(text) ||
                          AddressUtils.isValidBitcoinAddress(text, true)
                        : true;

                    const updatedValidation = [
                        ...this.state.isValidLightningAddress
                    ];
                    updatedValidation[0] = isValid;

                    this.setState({
                        isValidLightningAddress: updatedValidation
                    });
                }}
                placeholder={localeString(
                    'views.Settings.AddContact.lnAddress'
                )}
                isValid={this.state.isValidLightningAddress[0]}
                index={0}
                setValidationState={(idx, isValid) => {
                    const updatedValidation = [
                        ...this.state.isValidLightningAddress
                    ];
                    updatedValidation[idx] = isValid;
                    this.setState({
                        isValidLightningAddress: updatedValidation
                    });
                }}
                isAdditionalField={false}
            />
        );
        const addFieldsToArray = (
            fieldArray: string[],
            fieldType: string,
            icon: React.ReactNode,
            validationArray: boolean[],
            validationFunction: (text: string, index: number) => void,
            placeholder: string
        ) => {
            if (fieldArray?.length > 0) {
                // For lnAddress, start from index 1 since index 0 is the default field
                const startIndex = fieldType === 'lnAddress' ? 1 : 0;
                fieldArray.slice(startIndex).forEach((value, idx) => {
                    const actualIndex =
                        fieldType === 'lnAddress' ? idx + 1 : idx;
                    allFields.push(
                        <ContactInputField
                            key={`${fieldType}-${actualIndex}`}
                            icon={icon}
                            value={value}
                            onChangeText={(text) => {
                                const updatedFields = [...fieldArray];
                                updatedFields[actualIndex] = text;
                                this.setState({ [fieldType]: updatedFields });
                                validationFunction(text, actualIndex);
                            }}
                            onValidate={(text) =>
                                validationFunction(text, actualIndex)
                            }
                            placeholder={placeholder}
                            isValid={validationArray[actualIndex]}
                            index={actualIndex}
                            setValidationState={(idx, isValid) => {
                                const updatedValidation = [...validationArray];
                                updatedValidation[idx] = isValid;
                                this.setState({
                                    [`isValid${
                                        fieldType.charAt(0).toUpperCase() +
                                        fieldType.slice(1)
                                    }`]: updatedValidation
                                });
                            }}
                            isAdditionalField={true}
                            onDelete={() =>
                                this.removeField(fieldType, actualIndex)
                            }
                        />
                    );
                });
            }
        };

        const {
            lnAddress,
            bolt12Address,
            bolt12Offer,
            onchainAddress,
            nip05,
            nostrNpub,
            pubkey,
            cashuPubkey,
            isValidLightningAddress,
            isValidBolt12Address,
            isValidBolt12Offer,
            isValidPubkey,
            isValidCashuPubkey,
            isValidOnchainAddress,
            isValidNIP05,
            isValidNpub
        } = this.state;
        addFieldsToArray(
            lnAddress,
            'lnAddress',
            <LightningBolt />,
            isValidLightningAddress,
            this.onChangeLightningAddress,
            localeString('views.Settings.AddContact.lnAddress')
        );
        if (bolt12Address?.length > 0) {
            addFieldsToArray(
                bolt12Address,
                'bolt12Address',
                <LightningBolt />,
                isValidBolt12Address,
                this.onChangeBolt12Address,
                localeString('views.Settings.Bolt12Address')
            );
        }
        if (bolt12Offer?.length > 0) {
            addFieldsToArray(
                bolt12Offer,
                'bolt12Offer',
                <LightningBolt />,
                isValidBolt12Offer,
                this.onChangeBolt12Offer,
                localeString('views.Settings.Bolt12Offer')
            );
        }
        if (pubkey?.length > 0) {
            addFieldsToArray(
                pubkey,
                'pubkey',
                <LightningBolt />,
                isValidPubkey,
                this.onChangePubkey,
                localeString('views.Settings.AddContact.pubkey')
            );
        }
        if (cashuPubkey?.length > 0) {
            addFieldsToArray(
                cashuPubkey,
                'cashuPubkey',
                <CashuIcon />,
                isValidCashuPubkey,
                this.onChangeCashuPubkey,
                localeString('views.Settings.AddContact.cashuPubkey')
            );
        }

        if (onchainAddress?.length > 0) {
            addFieldsToArray(
                onchainAddress,
                'onchainAddress',
                <BitcoinIcon />,
                isValidOnchainAddress,
                this.onChangeOnchainAddress,
                localeString('views.Settings.AddContact.onchainAddress')
            );
        }
        if (nip05?.length > 0) {
            addFieldsToArray(
                nip05,
                'nip05',
                <VerifiedAccount />,
                isValidNIP05,
                this.onChangeNIP05,
                localeString('views.Settings.AddContact.nip05')
            );
        }
        if (nostrNpub?.length > 0) {
            addFieldsToArray(
                nostrNpub,
                'nostrNpub',
                <KeySecurity />,
                isValidNpub,
                this.onChangeNpub,
                localeString('views.Settings.AddContact.nostrNpub')
            );
        }
        return allFields;
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

        const dynamicStyles = {
            textInput: {
                ...styles.textInput,
                color: themeColor('text')
            },
            addFieldButton: {
                ...styles.addFieldButton,
                backgroundColor: themeColor('secondary')
            },
            modalContent: {
                ...styles.modalContent,
                backgroundColor: themeColor('background')
            },
            modalTitle: {
                ...styles.modalTitle,
                color: themeColor('text')
            },
            modalItemIcon: {
                ...styles.modalItemIcon,
                backgroundColor: themeColor('secondary')
            },
            modalItemText: {
                ...styles.modalItemText,
                color: themeColor('text')
            },
            photoWrapper: {
                ...styles.photoWrapper,
                backgroundColor: themeColor('secondaryText')
            }
        };

        const dropdownValues = [
            {
                key: 'LN address',
                translateKey: 'general.lightningAddressCondensed',
                value: 'lnAddress',
                icon: <LightningBolt />
            },
            {
                key: 'BOLT 12 address',
                translateKey: 'views.Settings.Bolt12Address',
                value: 'bolt12Address',
                icon: <LightningBolt />
            },
            {
                key: 'BOLT 12 offer',
                translateKey: 'views.Settings.Bolt12Offer',
                value: 'bolt12Offer',
                icon: <LightningBolt />
            },
            {
                key: 'Public key',
                translateKey: 'views.NodeInfo.pubkey',
                value: 'pubkey',
                icon: <LightningBolt />
            },
            {
                key: 'Cashu pubkey',
                translateKey: 'views.Settings.AddContact.cashuPubkey',
                value: 'cashuPubkey',
                icon: <CashuIcon />
            },
            {
                key: 'Onchain address',
                translateKey: 'views.Settings.AddContact.onchainAddress',
                value: 'onchainAddress',
                icon: <BitcoinIcon />
            },
            {
                key: 'NIP-05',
                translateKey: 'views.Settings.AddContact.nip05',
                value: 'nip05',
                icon: <VerifiedAccount />
            },
            {
                key: 'Nostr npub',
                translateKey: 'views.Settings.AddContact.nostrNpub',
                value: 'nostrNpub',
                icon: <KeySecurity />
            }
        ];

        const AddPhotos = () => (
            <AddIcon
                fill={themeColor('background')}
                width="24"
                height="24"
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
                    style={styles.container}
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
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        {/* Profile Photo */}
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
                                <View style={dynamicStyles.photoWrapper}>
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

                        {/* Name Field */}
                        <View
                            style={{
                                width: '100%',
                                marginTop: 18
                            }}
                        >
                            <TextInput
                                onChangeText={(text) =>
                                    this.setState({ name: text })
                                }
                                value={name}
                                placeholder={localeString(
                                    'views.Settings.AddContact.name'
                                )}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
                                style={dynamicStyles.textInput}
                                autoCapitalize="none"
                            />
                        </View>
                        <Divider
                            orientation="horizontal"
                            style={styles.divider}
                        />

                        {/* Description Field */}
                        <View style={styles.inputWrapper}>
                            <TextInput
                                onChangeText={(text) =>
                                    this.setState({ description: text })
                                }
                                value={description}
                                multiline
                                placeholder={localeString(
                                    'views.Settings.AddContact.description'
                                )}
                                placeholderTextColor={themeColor(
                                    'secondaryText'
                                )}
                                style={[dynamicStyles.textInput]}
                                autoCapitalize="none"
                            />
                        </View>
                        <Divider
                            orientation="horizontal"
                            style={styles.divider}
                        />

                        {/* Mandatory Fields */}
                        <View>{this.renderAddedFields()}</View>

                        {/* Add Field Button */}
                        <TouchableOpacity
                            onPress={() =>
                                this.setState({ showFieldModal: true })
                            }
                            style={dynamicStyles.addFieldButton}
                            activeOpacity={0.7}
                        >
                            <View style={styles.addFieldContent}>
                                <Icon
                                    name="add"
                                    size={26}
                                    color={themeColor('text')}
                                    style={styles.addIcon}
                                />
                                <Text
                                    style={[
                                        styles.addFieldText,
                                        { color: themeColor('text') }
                                    ]}
                                >
                                    {localeString(
                                        'views.Settings.AddContact.addField'
                                    )}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Field Selection Modal */}
                        <Modal
                            animationType="slide"
                            transparent={true}
                            visible={this.state.showFieldModal}
                            onRequestClose={() =>
                                this.setState({ showFieldModal: false })
                            }
                        >
                            <View style={styles.modalContainer}>
                                <View style={dynamicStyles.modalContent}>
                                    <View style={styles.modalHeader}>
                                        <Text style={dynamicStyles.modalTitle}>
                                            {localeString(
                                                'views.Settings.AddContact.selectField'
                                            )}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() =>
                                                this.setState({
                                                    showFieldModal: false
                                                })
                                            }
                                        >
                                            <Icon
                                                name="close"
                                                size={24}
                                                color={themeColor('text')}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                    <ScrollView style={styles.modalList}>
                                        {dropdownValues.map((value, index) => (
                                            <View key={index}>
                                                <TouchableOpacity
                                                    style={styles.modalItem}
                                                    onPress={() =>
                                                        this.addField(
                                                            value.value
                                                        )
                                                    }
                                                >
                                                    <View
                                                        style={
                                                            dynamicStyles.modalItemIcon
                                                        }
                                                    >
                                                        {value.icon}
                                                    </View>
                                                    <Text
                                                        style={
                                                            dynamicStyles.modalItemText
                                                        }
                                                    >
                                                        {value.key}
                                                    </Text>
                                                </TouchableOpacity>
                                                <Divider
                                                    orientation="horizontal"
                                                    style={{
                                                        marginVertical: 0
                                                    }}
                                                />
                                            </View>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>
                        </Modal>
                    </ScrollView>

                    {/* Save Button */}
                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.Settings.AddContact.saveContact'
                            )}
                            onPress={this.saveContact}
                            disabled={
                                // Check if any field array has invalid entries
                                (lnAddress.length > 0 &&
                                    isValidLightningAddress.includes(false)) ||
                                (bolt12Address.length > 0 &&
                                    isValidBolt12Address.includes(false)) ||
                                (bolt12Offer.length > 0 &&
                                    isValidBolt12Offer.includes(false)) ||
                                (pubkey.length > 0 &&
                                    isValidPubkey.includes(false)) ||
                                (cashuPubkey.length > 0 &&
                                    isValidCashuPubkey.includes(false)) ||
                                (onchainAddress.length > 0 &&
                                    isValidOnchainAddress.includes(false)) ||
                                (nip05.length > 0 &&
                                    isValidNIP05.includes(false)) ||
                                (nostrNpub.length > 0 &&
                                    isValidNpub.includes(false)) ||
                                !(
                                    (lnAddress.length > 0 &&
                                        lnAddress[0] &&
                                        isValidLightningAddress[0]) ||
                                    (bolt12Address.length > 0 &&
                                        bolt12Address[0] &&
                                        isValidBolt12Address[0]) ||
                                    (bolt12Offer.length > 0 &&
                                        bolt12Offer[0] &&
                                        isValidBolt12Offer[0]) ||
                                    (onchainAddress.length > 0 &&
                                        onchainAddress[0] &&
                                        isValidOnchainAddress[0]) ||
                                    (pubkey.length > 0 &&
                                        pubkey[0] &&
                                        isValidPubkey[0]) ||
                                    (cashuPubkey.length > 0 &&
                                        cashuPubkey[0] &&
                                        isValidCashuPubkey[0]) ||
                                    (nip05.length > 0 &&
                                        nip05[0] &&
                                        isValidNIP05[0]) ||
                                    (nostrNpub.length > 0 &&
                                        nostrNpub[0] &&
                                        isValidNpub[0])
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
    container: {
        flex: 1,
        backgroundColor: 'transparent'
    },
    scrollContent: {
        flexGrow: 1
    },
    inputWrapper: {
        width: '100%'
    },
    textInput: {
        fontSize: 18,
        paddingVertical: 5,
        width: '100%',
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center'
    },
    divider: {
        marginVertical: Platform.OS === 'ios' ? 16 : 10
    },
    addFieldButton: {
        alignSelf: 'center',
        width: '90%',
        marginTop: 24,
        marginBottom: 16,
        padding: 10,
        borderRadius: 12
    },
    addFieldContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4
    },
    addIcon: {
        marginRight: 0
    },
    addFieldText: {
        fontSize: 17,
        fontFamily: 'PPNeueMontreal-Medium',
        letterSpacing: 0.2
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
    },
    modalContent: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
        maxHeight: '70%'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 12
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600'
    },
    modalList: {
        paddingHorizontal: 16
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12
    },
    modalItemIcon: {
        width: 26,
        height: 26,
        borderRadius: 16,
        marginRight: 12,
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalItemText: {
        fontSize: 16,
        fontWeight: '500'
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    icons: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 8
    },
    fieldInput: {
        flex: 1,
        fontSize: 18,
        paddingVertical: 5
    },
    photoWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
    },
    photo: {
        width: '100%',
        height: '100%',
        borderRadius: 60
    },
    button: {
        paddingHorizontal: 20,
        paddingVertical: 8
    }
});
