import React from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    Text,
    Platform,
    TouchableOpacity
} from 'react-native';
import { ButtonGroup, Icon } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';
import isEqual from 'lodash/isEqual';
import Slider from '@react-native-community/slider';
import type { Nip47SingleMethod } from '@getalby/sdk/dist/nwc/types';

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
import { numberWithCommas } from '../../../utils/UnitsUtils';

import NostrWalletConnectStore, {
    DEFAULT_NOSTR_RELAYS
} from '../../../stores/NostrWalletConnectStore';
import ModalStore from '../../../stores/ModalStore';

import NWCConnection, {
    PermissionType,
    TimeUnit
} from '../../../models/NWCConnection';

import ForwardIcon from '../../../assets/images/SVG/Caret Right-3.svg';

interface AddOrEditNWCConnectionProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'AddOrEditNWCConnection',
        { connectionId?: string; isEdit?: boolean }
    >;
    NostrWalletConnectStore: NostrWalletConnectStore;
    ModalStore: ModalStore;
}

interface AddOrEditNWCConnectionState {
    connectionName: string;
    selectedRelayUrl: string;
    customRelayUrl: string;
    selectedPermissions: Nip47SingleMethod[];
    selectedBudgetRenewalIndex: number;
    expiresAt: Date | undefined;
    error: string;
    loading: boolean;
    originalConnection: NWCConnection | null;
    hasChanges: boolean;
    selectedPermissionType: PermissionType | null;
    selectedExpiryPresetIndex: number;
    showCustomExpiryInput: boolean;
    customExpiryValue: number | null;
    customExpiryUnit: TimeUnit;
    budgetValue: number;
    maxBudgetLimit: number;
    showAdvancedSettings: boolean;
    showCustomPermissions: boolean;
}

@inject('NostrWalletConnectStore', 'ModalStore')
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
            customRelayUrl: '',
            selectedPermissions: NostrConnectUtils.getFullAccessPermissions(),
            selectedBudgetRenewalIndex: 0,
            expiresAt: NostrConnectUtils.getExpiryDateFromPreset(0),
            error: '',
            loading: false,
            originalConnection: null,
            hasChanges: false,
            selectedPermissionType: PermissionType.FullAccess,
            selectedExpiryPresetIndex: 0,
            showCustomExpiryInput: false,
            customExpiryValue: null,
            customExpiryUnit: NostrConnectUtils.TIME_UNITS[1],
            budgetValue: 0,
            maxBudgetLimit: 0,
            showAdvancedSettings: false,
            showCustomPermissions: false
        };
    }

    private unsubscribeFocus?: () => void;

    loadData = async () => {
        const { route, NostrWalletConnectStore } = this.props;
        const connectionId = route.params?.connectionId;
        await NostrWalletConnectStore.loadMaxBudget();
        if (connectionId) {
            await this.loadConnectionForEdit(connectionId);
        } else {
            await this.updateMaxBudgetLimit();
        }
    };

    async componentDidMount() {
        const { navigation } = this.props;
        await this.loadData();
        this.unsubscribeFocus = navigation.addListener('focus', async () => {
            await this.loadData();
        });
    }

    updateMaxBudgetLimit = async () => {
        const { NostrWalletConnectStore } = this.props;
        const maxLimit = NostrWalletConnectStore.maxBudgetLimit;
        const existingBudgetValue = this.state.budgetValue || 0;
        this.setState({
            maxBudgetLimit: Math.max(0, maxLimit),
            budgetValue: existingBudgetValue
        });
    };

    componentWillUnmount() {
        if (this.unsubscribeFocus) {
            this.unsubscribeFocus();
        }
    }

    loadConnectionForEdit = async (connectionId: string) => {
        const { NostrWalletConnectStore } = this.props;
        await NostrWalletConnectStore.loadConnections();
        const connection = NostrWalletConnectStore.getConnection(connectionId);
        if (connection) {
            const budgetRenewalIndex = NostrConnectUtils.getBudgetRenewalIndex(
                connection.budgetRenewal
            );
            const permissionType = NostrConnectUtils.determinePermissionType(
                connection.permissions
            );

            const budgetValue = connection.maxAmountSats
                ? parseInt(connection.maxAmountSats.toString(), 10)
                : 0;

            const selectedExpiryPresetIndex =
                NostrConnectUtils.getExpiryPresetIndex(
                    connection.expiresAt!,
                    connection.createdAt
                );
            const showCustomExpiryInput = selectedExpiryPresetIndex === 4;
            let customExpiryValue = connection.customExpiryValue || null;
            let customExpiryUnit =
                connection.customExpiryUnit || NostrConnectUtils.TIME_UNITS[1];
            const isCustomRelay = !DEFAULT_NOSTR_RELAYS.find(
                (relay) => relay === connection.relayUrl
            );
            const maxBudgetLimit = NostrWalletConnectStore.maxBudgetLimit;
            this.setState({
                connectionName: connection.name,
                selectedRelayUrl: isCustomRelay
                    ? localeString('general.custom')
                    : connection.relayUrl || DEFAULT_NOSTR_RELAYS[0],
                customRelayUrl: connection.relayUrl || '',
                selectedPermissions: connection.permissions,
                selectedBudgetRenewalIndex: budgetRenewalIndex,
                expiresAt: connection.expiresAt!,
                originalConnection: connection,
                hasChanges: false,
                selectedPermissionType: permissionType,
                selectedExpiryPresetIndex,
                showCustomExpiryInput,
                customExpiryValue,
                customExpiryUnit,
                budgetValue,
                maxBudgetLimit: Math.max(0, maxBudgetLimit),
                showAdvancedSettings: false,
                showCustomPermissions: false
            });
        }
    };

    checkForChanges = () => {
        const { originalConnection } = this.state;
        if (!originalConnection) return false;
        const currentState: any = {
            name: this.state.connectionName.trim(),
            relayUrl:
                this.state.selectedRelayUrl === localeString('general.custom')
                    ? this.state.customRelayUrl
                    : this.state.selectedRelayUrl,
            permissions: [...this.state.selectedPermissions].sort(),
            maxAmountSats:
                this.state.budgetValue > 0 ? this.state.budgetValue : undefined,
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

        if (this.state.selectedRelayUrl === localeString('general.custom')) {
            return this.state.customRelayUrl !== originalConnection.relayUrl;
        } else {
            return this.state.selectedRelayUrl !== originalConnection.relayUrl;
        }
    };

    isValidRelayUrl = (url: string) => {
        const pattern =
            /^(wss?:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z0-9-]+(:\d+)?(\/.*)?$/;
        return pattern.test(url);
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
            customExpiryValue,
            selectedPermissionType,
            budgetValue,
            maxBudgetLimit,
            customRelayUrl,
            selectedRelayUrl
        } = this.state;

        const basicValidation =
            connectionName.trim().length > 0 && selectedPermissions.length > 0;

        if (selectedRelayUrl === localeString('general.custom')) {
            if (
                customRelayUrl.trim().length <= 0 ||
                !this.isValidRelayUrl(customRelayUrl)
            ) {
                return false;
            }
        }
        if (!basicValidation) return false;

        if (showCustomExpiryInput) {
            if (
                !customExpiryValue ||
                typeof customExpiryValue !== 'number' ||
                customExpiryValue < 1 ||
                customExpiryValue > 999
            ) {
                return false;
            }
        }

        if (
            NostrConnectUtils.shouldShowBudget(
                selectedPermissionType,
                selectedPermissions
            )
        ) {
            if (budgetValue === 0 && maxBudgetLimit >= 0) {
                return false;
            }
        }

        return true;
    };

    validateConnectionInputs = () => {
        const { connectionName, selectedPermissions } = this.state;

        if (!connectionName.trim()) {
            throw new Error(
                localeString(
                    'views.Settings.NostrWalletConnect.validation.connectionNameRequired'
                )
            );
        }

        if (selectedPermissions.length === 0) {
            throw new Error(
                localeString(
                    'views.Settings.NostrWalletConnect.validation.atLeastOnePermissionRequired'
                )
            );
        }
    };

    selectPermissionType = (permissionType: PermissionType) => {
        if (this.state.selectedPermissionType === permissionType) {
            this.updateStateWithChangeTracking({
                selectedPermissionType: null,
                selectedPermissions: [],
                showCustomPermissions: false,
                budgetValue: 0
            });
            return;
        }

        const { permissions } = NostrConnectUtils.getPermissionsForType(
            permissionType,
            this.state.selectedPermissions
        );

        const shouldResetBudget =
            permissionType === PermissionType.ReadOnly ||
            !NostrConnectUtils.shouldShowBudget(permissionType, permissions);

        this.updateStateWithChangeTracking({
            selectedPermissionType: permissionType,
            selectedPermissions: permissions,
            showCustomPermissions: false,
            ...(shouldResetBudget && { budgetValue: 0 })
        });
    };

    togglePermission = (permission: Nip47SingleMethod) => {
        const { selectedPermissions, selectedPermissionType } = this.state;
        const isAdding = !selectedPermissions.includes(permission);

        let newPermissions: Nip47SingleMethod[];
        if (isAdding) {
            if (
                selectedPermissionType === PermissionType.FullAccess ||
                selectedPermissionType === PermissionType.ReadOnly
            ) {
                newPermissions = [permission];
            } else {
                newPermissions = [...selectedPermissions, permission];
            }
        } else {
            newPermissions = selectedPermissions.filter(
                (p) => p !== permission
            );
        }

        const newPermissionType =
            NostrConnectUtils.determinePermissionType(newPermissions);

        // Reset budget when switching to ReadOnly or any non-budget permission
        const shouldResetBudget =
            newPermissionType === PermissionType.ReadOnly ||
            !NostrConnectUtils.shouldShowBudget(
                newPermissionType,
                newPermissions
            );

        this.updateStateWithChangeTracking({
            selectedPermissions: newPermissions,
            selectedPermissionType: newPermissionType,
            ...(shouldResetBudget && { budgetValue: 0 })
        });
    };

    getBudgetStep = (maxLimit: number): number => {
        if (maxLimit <= 0) return 1;
        if (maxLimit <= 1000) return 1;
        const dynamicStep = Math.max(1, Math.floor(maxLimit / 1000));
        const orderOfMagnitude = Math.floor(Math.log10(dynamicStep));
        const roundedStep = Math.pow(10, orderOfMagnitude);
        return roundedStep;
    };

    handleBudgetValueChange = (value: number) => {
        const clampedValue = Math.max(
            0,
            Math.min(Math.round(value), this.state.maxBudgetLimit || 0)
        );

        this.setState(
            {
                budgetValue: clampedValue,
                error: ''
            },
            () => {
                if (this.state.originalConnection) {
                    const hasChanges = this.checkForChanges();
                    this.setState({ hasChanges });
                }
            }
        );
    };

    selectExpiryPreset = (presetIndex: number) => {
        const expiryDate = NostrConnectUtils.getExpiryDateFromPreset(
            presetIndex,
            this.state.customExpiryValue || undefined,
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
                budgetValue: 0,
                error: ''
            });
            return;
        }

        const value = parseInt(numericText, 10);

        if (value < 0) {
            this.updateStateWithChangeTracking({
                budgetValue: 0,
                error: ''
            });
            return;
        }
        const clampedValue = Math.min(value, this.state.maxBudgetLimit);
        this.updateStateWithChangeTracking({
            budgetValue: clampedValue,
            error: ''
        });
    };

    buildConnectionParams = async (isEdit: boolean, connectionId?: string) => {
        this.validateConnectionInputs();
        const {
            connectionName,
            selectedRelayUrl,
            selectedPermissions,
            selectedBudgetRenewalIndex,
            selectedPermissionType,
            budgetValue,
            expiresAt,
            customExpiryValue,
            customExpiryUnit,
            showCustomExpiryInput,
            maxBudgetLimit,
            customRelayUrl
        } = this.state;
        const { NostrWalletConnectStore } = this.props;

        const budgetRenewalOptions =
            NostrConnectUtils.getBudgetRenewalOptions();
        const budgetRenewal =
            budgetRenewalOptions[selectedBudgetRenewalIndex]?.key || 'never';
        const isCustomRelay =
            selectedRelayUrl === localeString('general.custom');
        if (isCustomRelay) {
            const { status, error } = await NostrWalletConnectStore.pingRelay(
                customRelayUrl
            );
            if (!status) {
                throw new Error(error!);
            }
        }
        const params: any = {
            ...(connectionId && { id: connectionId }),
            name: connectionName.trim(),
            relayUrl: isCustomRelay ? customRelayUrl : selectedRelayUrl,
            permissions: selectedPermissions,
            budgetRenewal
        };

        // Budget is required for FullAccess or when permissions include pay_invoice/pay_keysend
        if (
            NostrConnectUtils.shouldShowBudget(
                selectedPermissionType,
                selectedPermissions
            )
        ) {
            if (budgetValue === 0 && maxBudgetLimit > 0) {
                throw new Error(
                    localeString(
                        'views.Settings.NostrWalletConnect.validation.budgetRequired'
                    )
                );
            }
        }

        if (budgetValue > 0) {
            if (isEdit && connectionId) {
                params.maxAmountSats = budgetValue;
            } else {
                params.budgetAmount = budgetValue;
            }
        } else if (isEdit && connectionId) {
            params.maxAmountSats = undefined;
        }

        params.expiresAt = expiresAt;
        if (showCustomExpiryInput) {
            params.customExpiryValue = customExpiryValue;
            params.customExpiryUnit = customExpiryUnit;
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
                    'stores.NostrWalletConnectStore.error.connectionNotFound'
                )
            });
            return;
        }
        this.setState({ loading: true, error: '' });
        try {
            await NostrWalletConnectStore.loadConnections();
            const connection =
                NostrWalletConnectStore.getConnection(connectionId);
            if (!connection) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.connectionNotFound'
                    )
                );
            }
            const totalSpendSats = connection.totalSpendSats;
            const lastBudgetReset = connection.lastBudgetReset;
            const params = await this.buildConnectionParams(
                false,
                connectionId
            );
            if (!params) return;
            params.totalSpendSats = totalSpendSats;
            params.lastBudgetReset = lastBudgetReset;
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
            const params = await this.buildConnectionParams(
                !!isEdit,
                connectionId
            );
            if (!params) return;

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
        const { selectedPermissionType, showCustomPermissions } = this.state;
        const isCustom = permissionType.key === PermissionType.Custom;

        let isSelected: boolean;
        if (isCustom) {
            isSelected = showCustomPermissions;
        } else {
            isSelected = selectedPermissionType === permissionType.key;
        }

        if (isCustom) {
            return (
                <View key={permissionType.key} style={{ marginTop: 20 }}>
                    <TouchableOpacity
                        onPress={() => {
                            this.setState({
                                showCustomPermissions: !showCustomPermissions
                            });
                        }}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}
                    >
                        <View style={{ flex: 1 }}>
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
                        <View style={{ marginLeft: 10 }}>
                            <ForwardIcon
                                stroke={themeColor('text')}
                                style={{
                                    transform: [
                                        {
                                            rotate: isSelected
                                                ? '90deg'
                                                : '0deg'
                                        }
                                    ]
                                }}
                            />
                        </View>
                    </TouchableOpacity>
                </View>
            );
        }

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
                <View
                    style={{
                        alignSelf: 'center'
                    }}
                >
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
        const { selectedPermissions, showCustomPermissions } = this.state;
        const isSelected = selectedPermissions.includes(permission.key);

        if (!showCustomPermissions) return null;

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
                <View
                    style={{
                        alignSelf: 'center'
                    }}
                >
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
        const { navigation, route, NostrWalletConnectStore } = this.props;
        const {
            connectionName,
            selectedBudgetRenewalIndex,
            selectedExpiryPresetIndex,
            error,
            loading,
            maxBudgetLimit,
            showAdvancedSettings,
            showCustomExpiryInput,
            customExpiryValue,
            customExpiryUnit,
            budgetValue,
            selectedPermissionType,
            selectedPermissions,
            customRelayUrl
        } = this.state;
        const { persistentNWCServiceEnabled } = NostrWalletConnectStore;
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
                        loading ? (
                            <View style={{ marginRight: 10 }}>
                                <LoadingIndicator size={30} />
                            </View>
                        ) : undefined
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

                        {/* Background Connection Info */}
                        {!route.params?.isEdit &&
                            Platform.OS !== 'ios' &&
                            persistentNWCServiceEnabled && (
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
                                        backgroundColor:
                                            themeColor('secondary'),
                                        borderRadius: 12
                                    }}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text
                                            style={{
                                                color: themeColor('text'),
                                                fontSize: 16,
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                fontWeight: '400'
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.NostrWalletConnect.backgroundConnectionTitle'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontSize: 14,
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
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
                                        onPress={
                                            this.showBackgroundConnectionInfo
                                        }
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
                                    values={[
                                        ...DEFAULT_NOSTR_RELAYS.map(
                                            (relay) => ({
                                                key: relay,
                                                value: relay
                                            })
                                        ),
                                        {
                                            key: localeString('general.custom'),
                                            value: localeString(
                                                'general.custom'
                                            )
                                        }
                                    ]}
                                />
                            </View>
                            {this.state.selectedRelayUrl ===
                                localeString('general.custom') && (
                                <View>
                                    <TextInput
                                        placeholder={localeString(
                                            'views.Settings.NostrWalletConnect.customNostrUrlPlaceholder'
                                        )}
                                        value={customRelayUrl}
                                        onChangeText={(text: string) =>
                                            this.updateStateWithChangeTracking({
                                                customRelayUrl: text
                                            })
                                        }
                                        autoCapitalize="none"
                                        style={styles.textInput}
                                        textColor={
                                            customRelayUrl.trim().length > 0 &&
                                            !this.isValidRelayUrl(
                                                customRelayUrl
                                            )
                                                ? themeColor('error')
                                                : themeColor('text')
                                        }
                                    />
                                </View>
                            )}
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

                        {/* Individual Permissions (only when custom section is expanded) */}
                        {this.state.showCustomPermissions && (
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

                        {NostrConnectUtils.shouldShowBudget(
                            this.state.selectedPermissionType,
                            this.state.selectedPermissions
                        ) && (
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

                                {/* Budget Input and Slider */}
                                <View
                                    style={{
                                        marginHorizontal: 5,
                                        marginTop: 5,
                                        marginBottom: 5
                                    }}
                                >
                                    {maxBudgetLimit > 0 ? (
                                        <>
                                            {/* Custom Budget Input */}
                                            <TextInput
                                                placeholder={localeString(
                                                    'views.Settings.NostrWalletConnect.budgetPlaceholder'
                                                )}
                                                value={
                                                    budgetValue > 0
                                                        ? numberWithCommas(
                                                              budgetValue.toString()
                                                          )
                                                        : ''
                                                }
                                                onChangeText={
                                                    this
                                                        .handleCustomBudgetValueChange
                                                }
                                                keyboardType="numeric"
                                                style={styles.textInput}
                                            />
                                            {/* Slider */}
                                            <View
                                                style={{
                                                    marginLeft: 10,
                                                    marginRight: 10
                                                }}
                                            >
                                                <Slider
                                                    style={{
                                                        width: '100%',
                                                        height: 30,
                                                        marginTop: 10
                                                    }}
                                                    minimumValue={0}
                                                    maximumValue={
                                                        maxBudgetLimit
                                                    }
                                                    value={budgetValue}
                                                    step={this.getBudgetStep(
                                                        maxBudgetLimit
                                                    )}
                                                    onValueChange={
                                                        this
                                                            .handleBudgetValueChange
                                                    }
                                                    minimumTrackTintColor={themeColor(
                                                        'highlight'
                                                    )}
                                                    maximumTrackTintColor={themeColor(
                                                        'secondary'
                                                    )}
                                                />
                                                <View
                                                    style={{
                                                        flexDirection: 'row',
                                                        justifyContent:
                                                            'space-between',
                                                        marginTop: 8
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            color: themeColor(
                                                                'secondaryText'
                                                            ),
                                                            fontFamily:
                                                                'PPNeueMontreal-Book',
                                                            fontSize: 12
                                                        }}
                                                    >
                                                        {'0'}{' '}
                                                        {localeString(
                                                            'general.sats'
                                                        )}
                                                    </Text>
                                                    <Text
                                                        style={{
                                                            color: themeColor(
                                                                'secondaryText'
                                                            ),
                                                            fontFamily:
                                                                'PPNeueMontreal-Book',
                                                            fontSize: 12
                                                        }}
                                                    >
                                                        {numberWithCommas(
                                                            maxBudgetLimit.toString()
                                                        )}{' '}
                                                        {localeString(
                                                            'general.sats'
                                                        )}
                                                    </Text>
                                                </View>
                                            </View>
                                        </>
                                    ) : (
                                        <View
                                            style={{
                                                padding: 20,
                                                alignItems: 'center',
                                                backgroundColor:
                                                    themeColor('secondary'),
                                                borderRadius: 8
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    fontFamily:
                                                        'PPNeueMontreal-Book',
                                                    fontSize: 14
                                                }}
                                            >
                                                {localeString(
                                                    'views.Settings.NostrWalletConnect.noBalanceAvailable'
                                                )}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Advanced Settings */}
                        <View style={styles.section}>
                            <TouchableOpacity
                                onPress={() => {
                                    this.setState({
                                        showAdvancedSettings:
                                            !showAdvancedSettings
                                    });
                                }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginHorizontal: 15,
                                    paddingVertical: 10
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontSize: 17,
                                        fontFamily: 'PPNeueMontreal-Book',
                                        fontWeight: '400'
                                    }}
                                >
                                    {localeString('general.advancedSettings')}
                                </Text>
                                <ForwardIcon
                                    stroke={themeColor('text')}
                                    style={{
                                        transform: [
                                            {
                                                rotate: this.state
                                                    .showAdvancedSettings
                                                    ? '90deg'
                                                    : '0deg'
                                            }
                                        ]
                                    }}
                                />
                            </TouchableOpacity>

                            {showAdvancedSettings && (
                                <>
                                    {/* Budget Renewal */}
                                    {NostrConnectUtils.shouldShowBudget(
                                        selectedPermissionType,
                                        selectedPermissions
                                    ) && (
                                        <View
                                            style={[
                                                styles.renewalContainer,
                                                { marginTop: 10 }
                                            ]}
                                        >
                                            <View
                                                style={
                                                    styles.sectionTitleContainer
                                                }
                                            >
                                                <Body bold>
                                                    {localeString(
                                                        'views.Settings.NostrWalletConnect.budgetRenewal'
                                                    )}
                                                </Body>
                                            </View>
                                            <ButtonGroup
                                                onPress={(
                                                    selectedIndex: number
                                                ) => {
                                                    this.updateStateWithChangeTracking(
                                                        {
                                                            selectedBudgetRenewalIndex:
                                                                selectedIndex
                                                        }
                                                    );
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
                                                    color: themeColor(
                                                        'secondary'
                                                    )
                                                }}
                                            />
                                        </View>
                                    )}

                                    {/* Connection Expiration (for all permission types) */}
                                    <View style={styles.section}>
                                        <View
                                            style={styles.sectionTitleContainer}
                                        >
                                            <Body bold>
                                                {localeString(
                                                    'views.Settings.NostrWalletConnect.connectionExpiration'
                                                )}
                                            </Body>
                                        </View>
                                        <View
                                            style={
                                                styles.sectionDescriptionContainer
                                            }
                                        >
                                            <Body small color="secondaryText">
                                                {localeString(
                                                    'views.Settings.NostrWalletConnect.connectionExpirationDescription'
                                                )}
                                            </Body>
                                        </View>

                                        <ButtonGroup
                                            onPress={(
                                                selectedIndex: number
                                            ) => {
                                                this.selectExpiryPreset(
                                                    selectedIndex
                                                );
                                            }}
                                            selectedIndex={
                                                selectedExpiryPresetIndex
                                            }
                                            buttons={expiryPresetButtons}
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

                                        {/* Custom Expiry Input */}
                                        {showCustomExpiryInput && (
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
                                                        value={customExpiryValue?.toString()}
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
                                                                customExpiryUnit
                                                            }
                                                            values={NostrConnectUtils.TIME_UNITS.map(
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
                                                                        selectedExpiryPresetIndex,
                                                                        customExpiryValue ||
                                                                            undefined,
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
                                </>
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
        marginHorizontal: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
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
