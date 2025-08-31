import React from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { ButtonGroup, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';

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
import NostrConnectUtils from '../../../utils/NostrConnectUtils';
import SettingsStore from '../../../stores/SettingsStore';
import NostrWalletConnectStore, {
    DEFAULT_NOSTR_RELAYS
} from '../../../stores/NostrWalletConnectStore';
import ModalStore from '../../../stores/ModalStore';

import NWCConnection, { PermissionsType } from '../../../models/NWCConnection';

import type { Nip47SingleMethod } from '@getalby/sdk/dist/nwc/types';

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
    expiryDays: string;
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
            expiryDays: '',
            description: '',
            error: '',
            loading: false,
            originalConnection: null,
            hasChanges: false,
            selectedPermissionType: 'full_access',
            selectedBudgetPresetIndex: 0,
            showCustomBudgetInput: false,
            selectedExpiryPresetIndex: 0, // Default to "1 Week"
            showCustomExpiryInput: false
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
            const expiryDays = NostrConnectUtils.calculateExpiryDays(
                connection.expiresAt
            );
            const permissionType = NostrConnectUtils.determinePermissionType(
                connection.permissions
            );
            const selectedBudgetPresetIndex =
                NostrConnectUtils.getBudgetPresetIndex(
                    connection.maxAmountSats
                );
            const showCustomBudgetInput = selectedBudgetPresetIndex === 4; // Custom option

            const expiryDaysNumber = expiryDays
                ? parseInt(expiryDays, 10)
                : undefined;
            const selectedExpiryPresetIndex =
                NostrConnectUtils.getExpiryPresetIndex(expiryDaysNumber);
            const showCustomExpiryInput = selectedExpiryPresetIndex === 4; // Custom option

            this.setState({
                connectionName: connection.name,
                selectedRelayUrl:
                    connection.relayUrl || DEFAULT_NOSTR_RELAYS[0],
                selectedPermissions: connection.permissions,
                maxAmountSats: connection.maxAmountSats?.toString() || '',
                selectedBudgetRenewalIndex: budgetRenewalIndex,
                expiryDays,
                description: connection.description || '',
                originalConnection: connection,
                hasChanges: false,
                selectedPermissionType: permissionType,
                selectedBudgetPresetIndex,
                showCustomBudgetInput,
                selectedExpiryPresetIndex,
                showCustomExpiryInput
            });
        }
    };

    checkForChanges = () => {
        const { originalConnection } = this.state;
        if (!originalConnection) return false;

        const currentMaxAmount = this.state.maxAmountSats
            ? parseInt(this.state.maxAmountSats, 10)
            : undefined;
        const currentBudgetRenewal =
            NostrConnectUtils.getBudgetRenewalOptions()[
                this.state.selectedBudgetRenewalIndex
            ]?.key || 'never';
        const currentExpiryDays = this.state.expiryDays
            ? parseInt(this.state.expiryDays, 10)
            : undefined;

        const originalMaxAmount = originalConnection.maxAmountSats;
        const originalBudgetRenewal =
            originalConnection.budgetRenewal || 'never';
        const originalExpiryDays = originalConnection.expiresAt
            ? Math.ceil(
                  (new Date(originalConnection.expiresAt).getTime() -
                      new Date().getTime()) /
                      (1000 * 60 * 60 * 24)
              )
            : undefined;

        const nameChanged =
            this.state.connectionName !== originalConnection.name;
        const relayChanged =
            this.state.selectedRelayUrl !==
            (originalConnection.relayUrl || DEFAULT_NOSTR_RELAYS[0]);
        const permissionsChanged =
            JSON.stringify(this.state.selectedPermissions.sort()) !==
            JSON.stringify(originalConnection.permissions.sort());
        const maxAmountChanged = currentMaxAmount !== originalMaxAmount;
        const budgetRenewalChanged =
            currentBudgetRenewal !== originalBudgetRenewal;
        const expiryChanged = currentExpiryDays !== originalExpiryDays;

        return (
            nameChanged ||
            relayChanged ||
            permissionsChanged ||
            maxAmountChanged ||
            budgetRenewalChanged ||
            expiryChanged
        );
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
        const { connectionName, selectedPermissions } = this.state;
        return (
            connectionName.trim().length > 0 && selectedPermissions.length > 0
        );
    };

    selectPermissionType = (permissionType: PermissionsType) => {
        // If the same permission type is selected, toggle it off
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
        let maxAmountSats = '';
        let showCustomBudgetInput = false;

        switch (presetIndex) {
            case 0:
                maxAmountSats = '10000';
                break;
            case 1:
                maxAmountSats = '100000';
                break;
            case 2:
                maxAmountSats = '1000000';
                break;
            case 3:
                maxAmountSats = '-1';
                break;
            case 4:
                showCustomBudgetInput = true;
                break;
        }

        this.updateStateWithChangeTracking({
            selectedBudgetPresetIndex: presetIndex,
            maxAmountSats,
            showCustomBudgetInput
        });
    };

    selectExpiryPreset = (presetIndex: number) => {
        const expiryDaysValue =
            NostrConnectUtils.getExpiryDaysFromPreset(presetIndex);
        const expiryDays = expiryDaysValue ? expiryDaysValue.toString() : '';
        const showCustomExpiryInput = presetIndex === 4;

        this.updateStateWithChangeTracking({
            selectedExpiryPresetIndex: presetIndex,
            expiryDays,
            showCustomExpiryInput
        });
    };

    regenerateConnection = async () => {
        const {
            connectionName,
            selectedRelayUrl,
            selectedPermissions,
            maxAmountSats,
            selectedBudgetRenewalIndex,
            expiryDays
        } = this.state;

        const { NostrWalletConnectStore, route, navigation } = this.props;
        const { connectionId } = route.params ?? {};

        if (!connectionId) {
            this.setState({
                error: 'Connection ID not found for regeneration'
            });
            return;
        }

        this.setState({ loading: true, error: '' });

        try {
            await NostrWalletConnectStore.deleteConnection(connectionId);
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
            if (maxAmountSats) {
                const budget = parseInt(maxAmountSats, 10);
                if (isNaN(budget) || budget < -1) {
                    this.setState({
                        error: localeString(
                            'views.Settings.NostrWalletConnect.validation.budgetAmountInvalid'
                        )
                    });
                    return;
                }
                params.budgetAmount = budget;
            }

            if (expiryDays && expiryDays.trim()) {
                const days = parseInt(expiryDays, 10);
                if (isNaN(days) || days <= 0) {
                    this.setState({
                        error: localeString(
                            'views.Settings.NostrWalletConnect.validation.expiryDaysInvalid'
                        )
                    });
                    return;
                }
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + days);
                params.expiresAt = expiryDate;
            }

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

    createConnection = async () => {
        const {
            connectionName,
            selectedRelayUrl,
            selectedPermissions,
            maxAmountSats,
            selectedBudgetRenewalIndex,
            expiryDays
        } = this.state;

        const { NostrWalletConnectStore, route, navigation } = this.props;
        const { connectionId, isEdit } = route.params ?? {};
        this.setState({ loading: true, error: '' });
        try {
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
            if (maxAmountSats) {
                const budget = parseInt(maxAmountSats, 10);
                if (isNaN(budget)) {
                    this.setState({
                        error: localeString(
                            'views.Settings.NostrWalletConnect.validation.budgetAmountInvalid'
                        )
                    });
                    return;
                }
                if (budget < -1) {
                    this.setState({
                        error: localeString(
                            'views.Settings.NostrWalletConnect.validation.budgetAmountInvalid'
                        )
                    });
                    return;
                }
                if (isEdit && connectionId) {
                    params.maxAmountSats = budget;
                } else {
                    params.budgetAmount = budget;
                }
            } else if (isEdit && connectionId) {
                params.maxAmountSats = undefined;
            }
            if (expiryDays && expiryDays.trim()) {
                const days = parseInt(expiryDays, 10);
                if (isNaN(days) || days <= 0) {
                    this.setState({
                        error: localeString(
                            'views.Settings.NostrWalletConnect.validation.expiryDaysInvalid'
                        )
                    });
                    return;
                }
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + days);
                params.expiresAt = expiryDate;
            } else if (isEdit && connectionId) {
                params.expiresAt = undefined;
            }
            if (isEdit && connectionId) {
                const updated = await NostrWalletConnectStore.updateConnection(
                    connectionId,
                    params
                );
                if (updated) {
                    setTimeout(() => {
                        navigation.goBack();
                    }, 100);
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

    renderPermissionTypeItem = (permissionType: any) => {
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

    renderPermissionItem = (permission: any) => {
        const { selectedPermissions, selectedPermissionType } = this.state;
        const isSelected = selectedPermissions.includes(permission.key);
        const isCustomMode = selectedPermissionType === 'custom';

        if (!isCustomMode) {
            return null;
        }

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

    render() {
        const { navigation, route } = this.props;
        const {
            connectionName,
            maxAmountSats,
            selectedBudgetRenewalIndex,
            selectedBudgetPresetIndex,
            selectedExpiryPresetIndex,
            expiryDays,
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
                                    backgroundColor: themeColor('warning'),
                                    borderColor: themeColor('secondary'),
                                    borderWidth: 1,
                                    padding: 10,
                                    borderRadius: 8,
                                    marginHorizontal: 10,
                                    marginTop: 10
                                }}
                            >
                                <Text style={{ color: themeColor('text') }}>
                                    {localeString(
                                        'views.Settings.NostrWalletConnect.relayChangeWarning'
                                    )}
                                </Text>
                            </View>
                        )}

                        {/* Background Connection Info Button */}
                        {!route.params?.isEdit && (
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
                                        {localeString(
                                            'views.Settings.NostrWalletConnect.budgetSettings'
                                        )}
                                    </Body>
                                </View>
                                <View
                                    style={styles.sectionDescriptionContainer}
                                >
                                    <Body small color="secondaryText">
                                        {localeString(
                                            'views.Settings.NostrWalletConnect.budgetSettingsDescription'
                                        )}
                                    </Body>
                                </View>

                                <View>
                                    <View style={styles.sectionTitleContainer}>
                                        <Body bold>
                                            {localeString(
                                                'views.Settings.NostrWalletConnect.budgetAmount'
                                            )}
                                        </Body>
                                    </View>
                                    <ButtonGroup
                                        onPress={(selectedIndex: number) => {
                                            this.selectBudgetPreset(
                                                selectedIndex
                                            );
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
                                            borderColor:
                                                themeColor('secondary'),
                                            marginHorizontal: 10,
                                            height: 40
                                        }}
                                        innerBorderStyle={{
                                            color: themeColor('secondary')
                                        }}
                                    />
                                </View>

                                {/* Custom Budget Input */}
                                {this.state.selectedBudgetPresetIndex === 4 && (
                                    <TextInput
                                        placeholder={localeString(
                                            'views.Settings.NostrWalletConnect.budgetSats'
                                        )}
                                        value={maxAmountSats}
                                        onChangeText={(text: string) =>
                                            this.updateStateWithChangeTracking({
                                                maxAmountSats: text
                                            })
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
                            {this.state.selectedExpiryPresetIndex === 4 && (
                                <TextInput
                                    placeholder="Expiry days"
                                    value={expiryDays}
                                    onChangeText={(text: string) =>
                                        this.updateStateWithChangeTracking({
                                            expiryDays: text
                                        })
                                    }
                                    keyboardType="numeric"
                                    style={styles.textInput}
                                />
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
                            title={
                                route.params?.isEdit
                                    ? this.isRelayChanged()
                                        ? localeString(
                                              'views.Settings.NostrWalletConnect.regenerateConnection'
                                          )
                                        : localeString(
                                              'views.Settings.NostrWalletConnect.updateConnection'
                                          )
                                    : localeString(
                                          'views.Settings.NostrWalletConnect.createConnection'
                                      )
                            }
                            onPress={
                                route.params?.isEdit && this.isRelayChanged()
                                    ? this.regenerateConnection
                                    : this.createConnection
                            }
                            secondary={
                                !this.isFormValid() ||
                                (route.params?.isEdit && !this.state.hasChanges)
                            }
                            disabled={
                                loading ||
                                !this.isFormValid() ||
                                (route.params?.isEdit && !this.state.hasChanges)
                            }
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
