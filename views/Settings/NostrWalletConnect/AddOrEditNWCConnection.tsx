import React from 'react';
import { View, StyleSheet, ScrollView, Text, Platform } from 'react-native';
import { ButtonGroup, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';
import isEqual from 'lodash/isEqual';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import { Body } from '../../../components/text/Body';
import Button from '../../../components/Button';
import TextInput from '../../../components/TextInput';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Switch from '../../../components/Switch';
import DropdownSetting from '../../../components/DropdownSetting';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';

import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';
import NostrConnectUtils, {
    PermissionOption,
    IndividualPermissionOption
} from '../../../utils/NostrConnectUtils';

import SettingsStore from '../../../stores/SettingsStore';

import NostrWalletConnectStore, {
    DEFAULT_NOSTR_RELAYS
} from '../../../stores/NostrWalletConnectStore';
import ModalStore from '../../../stores/ModalStore';

import NWCConnection, {
    PermissionsType,
    TimeUnit
} from '../../../models/NWCConnection';

import type { Nip47SingleMethod } from '@getalby/sdk/dist/nwc/types';

const TIME_UNITS: TimeUnit[] = [
    localeString('time.hours'),
    localeString('time.days'),
    localeString('time.weeks'),
    localeString('time.months'),
    localeString('time.years')
];
interface AddOrEditNWCConnectionProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'AddOrEditNWCConnection',
        { connectionId?: string; isEdit?: boolean }
    >;
    SettingsStore: SettingsStore;
    NostrWalletConnectStore: NostrWalletConnectStore;
    ModalStore: ModalStore;
}

interface AddOrEditNWCConnectionState {
    connectionName: string;
    selectedRelayUrl: string;
    selectedPermissions: Nip47SingleMethod[];
    maxAmountSats: string;
    selectedBudgetRenewalIndex: number;
    expiresAt: Date;
    description: string;
    error: string;
    loading: boolean;
    originalConnection: NWCConnection | null;
    hasChanges: boolean;
    selectedPermissionType: PermissionsType | null;
    selectedBudgetPresetIndex: number;
    showCustomBudgetInput: boolean;
    selectedExpiryPresetIndex: number;
    showCustomExpiryInput: boolean;
    customExpiryValue: number | null;
    customExpiryUnit: TimeUnit;
}

@inject('SettingsStore', 'NostrWalletConnectStore', 'ModalStore')
@observer
export default class AddOrEditNWCConnection extends React.Component<
    AddOrEditNWCConnectionProps,
    AddOrEditNWCConnectionState
> {
    constructor(props: AddOrEditNWCConnectionProps) {
        super(props);
        this.state = {
            connectionName: '',
            selectedRelayUrl: DEFAULT_NOSTR_RELAYS[0],
            selectedPermissions: NostrConnectUtils.getFullAccessPermissions(),
            maxAmountSats: '10000',
            selectedBudgetRenewalIndex: 0,
            expiresAt: NostrConnectUtils.getExpiryDateFromPreset(0),
            description: '',
            error: '',
            loading: false,
            originalConnection: null,
            hasChanges: false,
            selectedPermissionType: 'full_access',
            selectedBudgetPresetIndex: 0,
            showCustomBudgetInput: false,
            selectedExpiryPresetIndex: 0,
            showCustomExpiryInput: false,
            customExpiryValue: null,
            customExpiryUnit: TIME_UNITS[1]
        };
    }

    componentDidMount() {
        const { route } = this.props;
        const connectionId = route.params?.connectionId;
        if (connectionId) {
            this.loadConnectionForEdit(connectionId);
        }
    }

    loadConnectionForEdit = (connectionId: string) => {
        const { NostrWalletConnectStore } = this.props;
        const connection = NostrWalletConnectStore.getConnection(connectionId);

        if (connection) {
            const budgetRenewalIndex = NostrConnectUtils.getBudgetRenewalIndex(
                connection.budgetRenewal
            );
            const permissionType = NostrConnectUtils.determinePermissionType(
                connection.permissions
            );
            const selectedBudgetPresetIndex =
                NostrConnectUtils.getBudgetPresetIndex(
                    connection.maxAmountSats
                );

            const showCustomBudgetInput = selectedBudgetPresetIndex === 4; // Custom option

            const selectedExpiryPresetIndex =
                NostrConnectUtils.getExpiryPresetIndex(connection.expiresAt);

            const showCustomExpiryInput = selectedExpiryPresetIndex === 4;

            let customExpiryValue = connection.customExpiryValue || null;
            let customExpiryUnit = connection.customExpiryUnit || TIME_UNITS[1];

            this.setState({
                connectionName: connection.name,
                selectedRelayUrl:
                    connection.relayUrl || DEFAULT_NOSTR_RELAYS[0],
                selectedPermissions: connection.permissions,
                maxAmountSats: connection.maxAmountSats?.toString() || '',
                selectedBudgetRenewalIndex: budgetRenewalIndex,
                expiresAt: connection.expiresAt!,
                description: connection.description || '',
                originalConnection: connection,
                hasChanges: false,
                selectedPermissionType: permissionType,
                selectedBudgetPresetIndex,
                showCustomBudgetInput,
                selectedExpiryPresetIndex,
                showCustomExpiryInput,
                customExpiryValue,
                customExpiryUnit
            });
        }
    };

    checkForChanges = () => {
        const { originalConnection } = this.state;
        if (!originalConnection) return false;
        const currentState: any = {
            name: this.state.connectionName.trim(),
            relayUrl: this.state.selectedRelayUrl,
            permissions: [...this.state.selectedPermissions].sort(),
            maxAmountSats: this.state.maxAmountSats
                ? parseInt(this.state.maxAmountSats, 10)
                : undefined,
            budgetRenewal:
                NostrConnectUtils.getBudgetRenewalOptions()[
                    this.state.selectedBudgetRenewalIndex
                ]?.key || 'never',
            expiresAt: this.state.expiresAt
                ? this.state.expiresAt.getTime()
                : undefined
        };
        if (this.state.showCustomExpiryInput) {
            currentState.customExpiryValue =
                this.state.customExpiryValue || undefined;
            currentState.customExpiryUnit = this.state.customExpiryUnit;
        }
        const originalState: any = {
            name: originalConnection.name,
            relayUrl: originalConnection.relayUrl || DEFAULT_NOSTR_RELAYS[0],
            permissions: [...originalConnection.permissions].sort(),
            maxAmountSats: originalConnection.maxAmountSats,
            budgetRenewal: originalConnection.budgetRenewal || 'never',
            expiresAt: originalConnection.expiresAt
                ? new Date(originalConnection.expiresAt).getTime()
                : undefined
        };
        if (
            originalConnection.customExpiryValue ||
            originalConnection.customExpiryUnit
        ) {
            originalState.customExpiryValue =
                originalConnection.customExpiryValue || undefined;
            originalState.customExpiryUnit =
                originalConnection.customExpiryUnit;
        }
        return !isEqual(currentState, originalState);
    };

    isRelayChanged = () => {
        const { originalConnection } = this.state;
        if (!originalConnection) return false;

        return (
            this.state.selectedRelayUrl !==
            (originalConnection.relayUrl || DEFAULT_NOSTR_RELAYS[0])
        );
    };

    updateStateWithChangeTracking = (newState: any) => {
        this.setState(newState, () => {
            if (this.state.originalConnection) {
                const hasChanges = this.checkForChanges();
                this.setState({ hasChanges });
            }
        });
    };

    isFormValid = () => {
        const {
            connectionName,
            selectedPermissions,
            showCustomExpiryInput,
            customExpiryValue
        } = this.state;

        const basicValidation =
            connectionName.trim().length > 0 && selectedPermissions.length > 0;

        if (!basicValidation) return false;

        if (showCustomExpiryInput && !customExpiryValue) {
            return false;
        }

        return true;
    };

    selectPermissionType = (permissionType: PermissionsType) => {
        if (this.state.selectedPermissionType === permissionType) {
            this.updateStateWithChangeTracking({
                selectedPermissionType: null,
                selectedPermissions: []
            });
            return;
        }

        const { permissions } = NostrConnectUtils.getPermissionsForType(
            permissionType,
            this.state.selectedPermissions
        );

        this.updateStateWithChangeTracking({
            selectedPermissionType: permissionType,
            selectedPermissions: permissions
        });
    };

    togglePermission = (permission: Nip47SingleMethod) => {
        const { selectedPermissions } = this.state;
        const newPermissions = selectedPermissions.includes(permission)
            ? selectedPermissions.filter((p) => p !== permission)
            : [...selectedPermissions, permission];

        this.updateStateWithChangeTracking({
            selectedPermissions: newPermissions
        });
    };

    selectBudgetPreset = (presetIndex: number) => {
        const budgetPresets = ['10000', '100000', '1000000', '-1', ''];
        const maxAmountSats = budgetPresets[presetIndex] || '';
        const showCustomBudgetInput = presetIndex === 4;

        this.updateStateWithChangeTracking({
            selectedBudgetPresetIndex: presetIndex,
            maxAmountSats,
            showCustomBudgetInput
        });
    };

    selectExpiryPreset = (presetIndex: number) => {
        const expiryDate = NostrConnectUtils.getExpiryDateFromPreset(
            presetIndex,
            this.state.customExpiryValue!,
            this.state.customExpiryUnit
        );
        const showCustomExpiryInput = presetIndex === 4;

        this.updateStateWithChangeTracking({
            selectedExpiryPresetIndex: presetIndex,
            expiresAt: expiryDate,
            showCustomExpiryInput,
            customExpiryValue: showCustomExpiryInput
                ? this.state.customExpiryValue
                : 0
        });
    };

    handleCustomExpiryValueChange = (text: string) => {
        const numericText = text.replace(/[^0-9]/g, '');

        if (!numericText) {
            this.updateStateWithChangeTracking({
                customExpiryValue: 0,
                error: ''
            });
            return;
        }

        const numValue = parseInt(numericText, 10);

        if (numValue > 999 || numValue === 0) {
            const errorMsg =
                numValue > 999
                    ? localeString('cashu.durationTooLong')
                    : localeString('cashu.invalidDurationNumber');
            this.setState({ error: errorMsg });
            return;
        }

        const newExpiryDate = NostrConnectUtils.getExpiryDateFromPreset(
            this.state.selectedExpiryPresetIndex,
            numValue,
            this.state.customExpiryUnit
        );

        this.updateStateWithChangeTracking({
            customExpiryValue: numValue,
            expiresAt: newExpiryDate,
            error: ''
        });
    };

    handleCustomBudgetValueChange = (text: string) => {
        const numericText = text.replace(/[^0-9]/g, '');

        if (!numericText) {
            this.updateStateWithChangeTracking({
                maxAmountSats: '',
                error: ''
            });
            return;
        }

        const value = parseInt(numericText, 10);
        if (value < 1) {
            this.updateStateWithChangeTracking({
                maxAmountSats: numericText,
                error: localeString(
                    'stores.NostrWalletConnectStore.budgetAmountRange'
                )
            });
            return;
        }

        this.updateStateWithChangeTracking({
            maxAmountSats: numericText,
            error: ''
        });
    };

    validateBudgetAmount = (
        maxAmountSats: string
    ): { isValid: boolean; budget?: number } => {
        if (!maxAmountSats) return { isValid: true };

        const budget = parseInt(maxAmountSats, 10);
        if (isNaN(budget) || budget < -1) {
            return { isValid: false };
        }

        return { isValid: true, budget };
    };

    buildConnectionParams = (isEdit: boolean, connectionId?: string) => {
        const {
            connectionName,
            selectedRelayUrl,
            selectedPermissions,
            maxAmountSats,
            selectedBudgetRenewalIndex
        } = this.state;

        const budgetRenewal =
            NostrConnectUtils.getBudgetRenewalOptions()[
                selectedBudgetRenewalIndex
            ].key;

        const params: any = {
            name: connectionName.trim(),
            relayUrl: selectedRelayUrl,
            permissions: selectedPermissions,
            budgetRenewal
        };

        const budgetValidation = this.validateBudgetAmount(maxAmountSats);
        if (!budgetValidation.isValid) {
            throw new Error(
                localeString(
                    'views.Settings.NostrWalletConnect.validation.budgetAmountInvalid'
                )
            );
        }

        if (budgetValidation.budget !== undefined) {
            if (isEdit && connectionId) {
                params.maxAmountSats = budgetValidation.budget;
            } else {
                params.budgetAmount = budgetValidation.budget;
            }
        } else if (isEdit && connectionId) {
            params.maxAmountSats = undefined;
        }

        const expiryDate = this.state.expiresAt;
        params.expiresAt = expiryDate;

        if (this.state.showCustomExpiryInput) {
            params.customExpiryValue = this.state.customExpiryValue;
            params.customExpiryUnit = this.state.customExpiryUnit;
        } else if (isEdit && connectionId) {
            params.customExpiryValue = undefined;
            params.customExpiryUnit = undefined;
        }

        return params;
    };

    regenerateConnection = async () => {
        const { NostrWalletConnectStore, route, navigation } = this.props;
        const { connectionId } = route.params ?? {};

        if (!connectionId) {
            this.setState({
                error: localeString(
                    'stores.NostrWalletConnectStore.connectionNotFound'
                )
            });
            return;
        }
        this.setState({ loading: true, error: '' });
        try {
            const params = this.buildConnectionParams(false);
            await NostrWalletConnectStore.deleteConnection(connectionId);
            const nostrUrl = await NostrWalletConnectStore.createConnection(
                params
            );
            if (nostrUrl) {
                const createdConnection =
                    NostrWalletConnectStore.connections[0];
                navigation.navigate('NWCConnectionQR', {
                    connectionId: createdConnection.id,
                    nostrUrl
                });
            }
        } catch (error) {
            this.setState({ error: (error as Error).message, loading: false });
        } finally {
            this.setState({ loading: false });
        }
    };

    createOrUpdateConnection = async () => {
        const { NostrWalletConnectStore, route, navigation } = this.props;
        const { connectionId, isEdit } = route.params ?? {};

        this.setState({ loading: true, error: '' });

        try {
            const params = this.buildConnectionParams(!!isEdit, connectionId);

            if (isEdit && connectionId) {
                const updated = await NostrWalletConnectStore.updateConnection(
                    connectionId,
                    params
                );
                if (updated) {
                    setTimeout(() => navigation.goBack(), 100);
                }
            } else {
                const nostrUrl = await NostrWalletConnectStore.createConnection(
                    params
                );
                if (nostrUrl) {
                    const createdConnection =
                        NostrWalletConnectStore.connections[0];
                    navigation.navigate('NWCConnectionQR', {
                        connectionId: createdConnection.id,
                        nostrUrl
                    });
                }
            }
        } catch (error) {
            this.setState({ error: (error as Error).message, loading: false });
        } finally {
            this.setState({ loading: false });
        }
    };

    clearErrors = () => {
        this.setState({ error: '' });
    };

    showBackgroundConnectionInfo = () => {
        const { ModalStore } = this.props;
        ModalStore.toggleInfoModal({
            title: localeString(
                'views.Settings.NostrWalletConnect.backgroundConnectionTitle'
            ),
            text: [
                localeString(
                    'views.Settings.NostrWalletConnect.backgroundConnectionDescription'
                ),
                localeString(
                    'views.Settings.NostrWalletConnect.backgroundDisclaimer1'
                ),
                localeString(
                    'views.Settings.NostrWalletConnect.backgroundDisclaimer2'
                ),
                localeString(
                    'views.Settings.NostrWalletConnect.backgroundDisclaimer3'
                )
            ]
        });
    };

    renderPermissionTypeItem = (permissionType: PermissionOption) => {
        const { selectedPermissionType } = this.state;
        const isSelected = selectedPermissionType === permissionType.key;

        return (
            <View
                key={permissionType.key}
                style={{ flexDirection: 'row', marginTop: 20 }}
            >
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontSize: 17,
                            fontFamily: 'PPNeueMontreal-Book',
                            fontWeight: '400'
                        }}
                    >
                        {permissionType.title}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            fontSize: 14,
                            marginTop: 4,
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    >
                        {permissionType.description}
                    </Text>
                </View>
                <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                    <Switch
                        value={isSelected}
                        onValueChange={() =>
                            this.selectPermissionType(permissionType.key)
                        }
                    />
                </View>
            </View>
        );
    };

    renderPermissionItem = (permission: IndividualPermissionOption) => {
        const { selectedPermissions, selectedPermissionType } = this.state;
        const isSelected = selectedPermissions.includes(permission.key);
        const isCustomMode = selectedPermissionType === 'custom';

        if (!isCustomMode) return null;

        return (
            <View
                key={permission.key}
                style={{ flexDirection: 'row', marginTop: 20 }}
            >
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontSize: 17,
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    >
                        {permission.title}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            fontSize: 14,
                            marginTop: 4,
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    >
                        {permission.description}
                    </Text>
                </View>
                <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                    <Switch
                        value={isSelected}
                        onValueChange={() =>
                            this.togglePermission(permission.key)
                        }
                    />
                </View>
            </View>
        );
    };

    createButtonGroupElement = (text: string, isSelected: boolean) => {
        return () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    fontSize: 13,
                    color: isSelected
                        ? themeColor('background')
                        : themeColor('text')
                }}
            >
                {text}
            </Text>
        );
    };

    getButtonTitle = (): string => {
        const { route } = this.props;
        if (!route.params?.isEdit) {
            return localeString(
                'views.Settings.NostrWalletConnect.createConnection'
            );
        }

        return this.isRelayChanged()
            ? localeString(
                  'views.Settings.NostrWalletConnect.regenerateConnection'
              )
            : localeString(
                  'views.Settings.NostrWalletConnect.updateConnection'
              );
    };

    isButtonDisabled = (): boolean => {
        const { route } = this.props;
        const { loading, hasChanges } = this.state;

        if (loading || !this.isFormValid()) return true;
        if (route.params?.isEdit && !hasChanges) return true;

        return false;
    };

    render() {
        const { navigation, route } = this.props;
        const {
            connectionName,
            maxAmountSats,
            selectedBudgetRenewalIndex,
            selectedBudgetPresetIndex,
            selectedExpiryPresetIndex,
            error,
            loading
        } = this.state;
        const budgetRenewalButtons: any =
            NostrConnectUtils.getBudgetRenewalOptions().map(
                (option, index) => ({
                    element: () => (
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 13,
                                color:
                                    selectedBudgetRenewalIndex === index
                                        ? themeColor('background')
                                        : themeColor('text')
                            }}
                        >
                            {option.title}
                        </Text>
                    )
                })
            );
        const budgetPresetButtons: any =
            NostrConnectUtils.getBudgetPresetButtons().map((button, index) => ({
                element: () => (
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: 13,
                            color:
                                selectedBudgetPresetIndex === index
                                    ? themeColor('background')
                                    : themeColor('text')
                        }}
                    >
                        {button}
                    </Text>
                )
            }));
        const expiryPresetButtons: any =
            NostrConnectUtils.getExpiryPresetButtons().map((button, index) => ({
                element: () => (
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: 13,
                            color:
                                selectedExpiryPresetIndex === index
                                    ? themeColor('background')
                                    : themeColor('text')
                        }}
                    >
                        {button}
                    </Text>
                )
            }));
        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: route.params?.isEdit
                            ? localeString(
                                  'views.Settings.NostrWalletConnect.editConnection'
                              )
                            : localeString(
                                  'views.Settings.NostrWalletConnect.addConnection'
                              ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        loading ? <LoadingIndicator size={20} /> : undefined
                    }
                    navigation={navigation}
                />

                <View style={styles.mainContainer}>
                    <ScrollView
                        style={styles.scrollContainer}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {error && (
                            <ErrorMessage
                                message={error}
                                dismissable
                                onPress={this.clearErrors}
                            />
                        )}
                        {route.params?.isEdit && this.isRelayChanged() && (
                            <View
                                style={{
                                    backgroundColor: themeColor('secondary'),
                                    borderColor: themeColor('secondary'),
                                    borderWidth: 1,
                                    padding: 10,
                                    marginBottom: 10,
                                    borderRadius: 8,
                                    marginHorizontal: 10,
                                    marginTop: 10
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('highlight')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.NostrWalletConnect.relayChangeWarning'
                                    )}
                                </Text>
                            </View>
                        )}

                        {/* Background Connection Info - Hidden on iOS */}
                        {!route.params?.isEdit && Platform.OS !== 'ios' && (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginHorizontal: 10,
                                    marginTop: 10,
                                    gap: 5,
                                    marginBottom: 15,
                                    padding: 16,
                                    backgroundColor: themeColor('secondary'),
                                    borderRadius: 12
                                }}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontSize: 16,
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontWeight: '400'
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.NostrWalletConnect.backgroundConnectionTitle'
                                        )}
                                    </Text>
                                    <Text
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontSize: 14,
                                            fontFamily: 'PPNeueMontreal-Book',
                                            marginTop: 4
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.NostrWalletConnect.backgroundConnectionDescription'
                                        )}
                                    </Text>
                                </View>
                                <Icon
                                    name="info"
                                    onPress={this.showBackgroundConnectionInfo}
                                    color={themeColor('text')}
                                    underlayColor="transparent"
                                    size={24}
                                />
                            </View>
                        )}

                        {/* Connection Name */}
                        <View style={styles.section}>
                            <View style={styles.sectionTitleContainer}>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.NostrWalletConnect.connectionName'
                                    )}
                                </Text>
                            </View>
                            <TextInput
                                placeholder={localeString(
                                    'views.Settings.NostrWalletConnect.enterConnectionName'
                                )}
                                value={connectionName}
                                onChangeText={(text: string) =>
                                    this.updateStateWithChangeTracking({
                                        connectionName: text
                                    })
                                }
                                style={styles.textInput}
                            />
                        </View>

                        {/* Relay URL */}
                        <View style={styles.section}>
                            <View style={{ marginHorizontal: 10 }}>
                                <DropdownSetting
                                    title={localeString(
                                        'views.Settings.NostrWalletConnect.chooseRelay'
                                    )}
                                    selectedValue={this.state.selectedRelayUrl}
                                    disabled={loading}
                                    onValueChange={(value: string) => {
                                        this.updateStateWithChangeTracking({
                                            selectedRelayUrl: value
                                        });
                                    }}
                                    values={DEFAULT_NOSTR_RELAYS.map(
                                        (relay) => ({
                                            key: relay,
                                            value: relay
                                        })
                                    )}
                                />
                            </View>
                        </View>

                        {/* Permission Types */}
                        <View style={styles.section}>
                            <View style={styles.sectionTitleContainer}>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.NostrWalletConnect.chooseWalletPermissions'
                                    )}
                                </Text>
                            </View>
                            <View style={{ marginHorizontal: 15 }}>
                                {NostrConnectUtils.getPermissionTypes().map(
                                    this.renderPermissionTypeItem
                                )}
                            </View>
                        </View>

                        {/* Individual Permissions (only in custom mode) */}
                        {this.state.selectedPermissionType === 'custom' && (
                            <View style={styles.section}>
                                <View style={styles.sectionTitleContainer}>
                                    <Body bold>
                                        {localeString(
                                            'views.Settings.NostrWalletConnect.authorizeAppTo'
                                        )}
                                    </Body>
                                </View>
                                <View style={{ marginHorizontal: 15 }}>
                                    {NostrConnectUtils.getAvailablePermissions().map(
                                        this.renderPermissionItem
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Budget (Only for Full Access and Custom) */}
                        {(this.state.selectedPermissionType === 'full_access' ||
                            this.state.selectedPermissionType === 'custom') && (
                            <View style={{ marginTop: 10 }}>
                                <View style={styles.sectionTitleContainer}>
                                    <Body bold>
                                        {localeString('views.BumpFee.budget')}
                                    </Body>
                                </View>
                                <View
                                    style={styles.sectionDescriptionContainer}
                                >
                                    <Body small color="secondaryText">
                                        {localeString(
                                            'views.Settings.NostrWalletConnect.budgetDescription'
                                        )}
                                    </Body>
                                </View>

                                <ButtonGroup
                                    onPress={(selectedIndex: number) => {
                                        this.selectBudgetPreset(selectedIndex);
                                    }}
                                    selectedIndex={
                                        this.state.selectedBudgetPresetIndex
                                    }
                                    buttons={budgetPresetButtons}
                                    selectedButtonStyle={{
                                        backgroundColor:
                                            themeColor('highlight'),
                                        borderRadius: 8
                                    }}
                                    containerStyle={{
                                        backgroundColor:
                                            themeColor('secondary'),
                                        borderRadius: 8,
                                        borderColor: themeColor('secondary'),
                                        marginHorizontal: 10,
                                        height: 40
                                    }}
                                    innerBorderStyle={{
                                        color: themeColor('secondary')
                                    }}
                                />

                                {/* Custom Budget Input */}
                                {this.state.selectedBudgetPresetIndex === 4 && (
                                    <TextInput
                                        placeholder={localeString(
                                            'views.BumpFee.budget'
                                        )}
                                        value={maxAmountSats}
                                        onChangeText={
                                            this.handleCustomBudgetValueChange
                                        }
                                        keyboardType="numeric"
                                        style={styles.textInput}
                                    />
                                )}

                                {/* Budget Renewal */}
                                <View style={styles.renewalContainer}>
                                    <View style={styles.sectionTitleContainer}>
                                        <Body bold>
                                            {localeString(
                                                'views.Settings.NostrWalletConnect.budgetRenewal'
                                            )}
                                        </Body>
                                    </View>
                                    <ButtonGroup
                                        onPress={(selectedIndex: number) => {
                                            this.updateStateWithChangeTracking({
                                                selectedBudgetRenewalIndex:
                                                    selectedIndex
                                            });
                                        }}
                                        selectedIndex={
                                            selectedBudgetRenewalIndex
                                        }
                                        buttons={budgetRenewalButtons}
                                        selectedButtonStyle={{
                                            backgroundColor:
                                                themeColor('highlight'),
                                            borderRadius: 8
                                        }}
                                        containerStyle={{
                                            backgroundColor:
                                                themeColor('secondary'),
                                            borderRadius: 8,
                                            borderColor:
                                                themeColor('secondary'),
                                            marginHorizontal: 10,
                                            marginTop: 10,
                                            height: 40
                                        }}
                                        innerBorderStyle={{
                                            color: themeColor('secondary')
                                        }}
                                    />
                                </View>
                            </View>
                        )}

                        {/* Connection Expiration (for all permission types) */}
                        <View style={styles.section}>
                            <View style={styles.sectionTitleContainer}>
                                <Body bold>
                                    {localeString(
                                        'views.Settings.NostrWalletConnect.connectionExpiration'
                                    )}
                                </Body>
                            </View>
                            <View style={styles.sectionDescriptionContainer}>
                                <Body small color="secondaryText">
                                    {localeString(
                                        'views.Settings.NostrWalletConnect.connectionExpirationDescription'
                                    )}
                                </Body>
                            </View>

                            <ButtonGroup
                                onPress={(selectedIndex: number) => {
                                    this.selectExpiryPreset(selectedIndex);
                                }}
                                selectedIndex={
                                    this.state.selectedExpiryPresetIndex
                                }
                                buttons={expiryPresetButtons}
                                selectedButtonStyle={{
                                    backgroundColor: themeColor('highlight'),
                                    borderRadius: 8
                                }}
                                containerStyle={{
                                    backgroundColor: themeColor('secondary'),
                                    borderRadius: 8,
                                    borderColor: themeColor('secondary'),
                                    marginHorizontal: 10,
                                    marginTop: 10,
                                    height: 40
                                }}
                                innerBorderStyle={{
                                    color: themeColor('secondary')
                                }}
                            />

                            {/* Custom Expiry Input */}
                            {this.state.showCustomExpiryInput && (
                                <View
                                    style={{
                                        marginHorizontal: 10,
                                        marginTop: 10
                                    }}
                                >
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            gap: 8
                                        }}
                                    >
                                        <TextInput
                                            placeholder={'1-999'}
                                            value={this.state.customExpiryValue?.toString()}
                                            onChangeText={
                                                this
                                                    .handleCustomExpiryValueChange
                                            }
                                            keyboardType="numeric"
                                            style={{ flex: 1 }}
                                        />
                                        <View style={{ flex: 1 }}>
                                            <DropdownSetting
                                                selectedValue={
                                                    this.state.customExpiryUnit
                                                }
                                                values={TIME_UNITS.map(
                                                    (unit) => ({
                                                        key: unit,
                                                        value: unit
                                                    })
                                                )}
                                                onValueChange={(
                                                    value: string
                                                ) => {
                                                    const newExpiryDate =
                                                        NostrConnectUtils.getExpiryDateFromPreset(
                                                            this.state
                                                                .selectedExpiryPresetIndex,
                                                            this.state
                                                                .customExpiryValue!,
                                                            value as TimeUnit
                                                        );

                                                    this.updateStateWithChangeTracking(
                                                        {
                                                            customExpiryUnit:
                                                                value as TimeUnit,
                                                            expiresAt:
                                                                newExpiryDate
                                                        }
                                                    );
                                                }}
                                            />
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>
                    </ScrollView>

                    <View
                        style={[
                            styles.bottomButtonContainer,
                            { backgroundColor: themeColor('background') }
                        ]}
                    >
                        <Button
                            title={this.getButtonTitle()}
                            onPress={
                                route.params?.isEdit && this.isRelayChanged()
                                    ? this.regenerateConnection
                                    : this.createOrUpdateConnection
                            }
                            secondary={this.isButtonDisabled()}
                            disabled={this.isButtonDisabled()}
                            noUppercase
                        />
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1
    },
    scrollContainer: {
        flex: 1
    },
    scrollContent: {
        paddingBottom: 20
    },
    section: {
        marginTop: 5,
        marginBottom: 10
    },
    sectionTitleContainer: {
        marginHorizontal: 15
    },
    sectionDescriptionContainer: {
        marginHorizontal: 15,
        marginTop: 5
    },
    textInput: {
        marginHorizontal: 10
    },
    renewalContainer: {
        marginTop: 5
    },
    bottomButtonContainer: {
        paddingHorizontal: 20,
        paddingVertical: 15,
        paddingBottom: 15
    }
});
