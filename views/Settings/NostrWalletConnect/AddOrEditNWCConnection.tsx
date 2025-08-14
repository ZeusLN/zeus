import React from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { ButtonGroup } from 'react-native-elements';
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
import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import SettingsStore from '../../../stores/SettingsStore';
import NostrWalletConnectStore from '../../../stores/NostrWalletConnectStore';
import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';
import NWCConnection from '../../../models/NWCConnection';
import {
    getAvailablePermissions,
    getBudgetRenewalOptions,
    getPermissionTypes,
    getFullAccessPermissions,
    determinePermissionType,
    calculateExpiryDays,
    getBudgetRenewalIndex,
    getPermissionsForType
} from '../../../utils/NostrConnectUtils';
import type { Nip47SingleMethod } from '@getalby/sdk/dist/nwc/types';

interface AddOrEditNWCConnectionProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'AddOrEditNWCConnection',
        { connectionId?: string; isEdit?: boolean }
    >;
    SettingsStore: SettingsStore;
    NostrWalletConnectStore: NostrWalletConnectStore;
}

interface AddOrEditNWCConnectionState {
    connectionName: string;
    selectedPermissions: Nip47SingleMethod[];
    maxAmountSats: string;
    selectedBudgetRenewalIndex: number;
    expiryDays: string;
    description: string;
    error: string;
    originalConnection: NWCConnection | null;
    hasChanges: boolean;
    selectedPermissionType:
        | 'full_access'
        | 'read_only'
        | 'isolated'
        | 'custom'
        | null;
    isIsolated: boolean;
}

@inject('SettingsStore', 'NostrWalletConnectStore')
@observer
export default class AddOrEditNWCConnection extends React.Component<
    AddOrEditNWCConnectionProps,
    AddOrEditNWCConnectionState
> {
    constructor(props: AddOrEditNWCConnectionProps) {
        super(props);
        this.state = {
            connectionName: '',
            selectedPermissions: getFullAccessPermissions(), // default to full access permissions
            maxAmountSats: '',
            selectedBudgetRenewalIndex: 0,
            expiryDays: '',
            description: '',
            error: '',
            originalConnection: null,
            hasChanges: false,
            selectedPermissionType: 'full_access',
            isIsolated: false
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
            const budgetRenewalIndex = getBudgetRenewalIndex(
                connection.budgetRenewal
            );
            const expiryDays = calculateExpiryDays(connection.expiresAt);
            const permissionType = determinePermissionType(
                connection.permissions,
                connection.isolated
            );

            this.setState({
                connectionName: connection.name,
                selectedPermissions: connection.permissions,
                maxAmountSats: connection.maxAmountSats?.toString() || '',
                selectedBudgetRenewalIndex: budgetRenewalIndex,
                expiryDays,
                description: connection.description || '',
                originalConnection: connection,
                hasChanges: false,
                selectedPermissionType: permissionType,
                isIsolated: connection.isolated || false
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
            getBudgetRenewalOptions()[this.state.selectedBudgetRenewalIndex]
                ?.key || 'never';
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
        const permissionsChanged =
            JSON.stringify(this.state.selectedPermissions.sort()) !==
            JSON.stringify(originalConnection.permissions.sort());
        const maxAmountChanged = currentMaxAmount !== originalMaxAmount;
        const budgetRenewalChanged =
            currentBudgetRenewal !== originalBudgetRenewal;
        const expiryChanged = currentExpiryDays !== originalExpiryDays;
        const isolatedChanged =
            this.state.isIsolated !== originalConnection.isolated;

        return (
            nameChanged ||
            permissionsChanged ||
            maxAmountChanged ||
            budgetRenewalChanged ||
            expiryChanged ||
            isolatedChanged
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

    selectPermissionType = (
        permissionType: 'full_access' | 'read_only' | 'isolated' | 'custom'
    ) => {
        // If the same permission type is selected, toggle it off
        if (this.state.selectedPermissionType === permissionType) {
            this.updateStateWithChangeTracking({
                selectedPermissionType: null,
                selectedPermissions: [],
                isIsolated: false
            });
            return;
        }

        const { permissions, isIsolated } = getPermissionsForType(
            permissionType,
            this.state.selectedPermissions
        );

        this.updateStateWithChangeTracking({
            selectedPermissionType: permissionType,
            selectedPermissions: permissions,
            isIsolated
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

    createConnection = async () => {
        const {
            connectionName,
            selectedPermissions,
            maxAmountSats,
            selectedBudgetRenewalIndex,
            expiryDays,
            isIsolated
        } = this.state;
        const { NostrWalletConnectStore, route } = this.props;
        const { connectionId, isEdit } = route.params ?? {};

        this.setState({ error: '' });
        NostrWalletConnectStore.setError(false);

        if (!connectionName.trim()) {
            this.setState({
                error: localeString(
                    'views.Settings.NostrWalletConnect.validation.connectionNameRequired'
                )
            });
            return;
        }

        if (selectedPermissions.length === 0) {
            this.setState({
                error: localeString(
                    'views.Settings.NostrWalletConnect.validation.atLeastOnePermissionRequired'
                )
            });
            return;
        }

        try {
            const budgetRenewal =
                getBudgetRenewalOptions()[selectedBudgetRenewalIndex].key;
            const params: any = {
                name: connectionName.trim(),
                permissions: selectedPermissions,
                budgetRenewal,
                isolated: isIsolated
            };
            if (maxAmountSats.trim()) {
                const budget = parseInt(maxAmountSats, 10);
                if (isNaN(budget) || budget <= 0) {
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
            if (expiryDays) {
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

            if (isEdit && connectionId) {
                const updated = await NostrWalletConnectStore.updateConnection(
                    connectionId,
                    params
                );
                if (updated) {
                    setTimeout(() => {
                        this.props.navigation.goBack();
                    }, 100);
                }
            } else {
                const nostrUrl = await NostrWalletConnectStore.createConnection(
                    params
                );
                if (nostrUrl) {
                    const createdConnection =
                        NostrWalletConnectStore.connections[0];
                    this.props.navigation.navigate('NWCConnectionQR', {
                        connectionId: createdConnection.id,
                        nostrUrl
                    });
                }
            }
        } catch (error: any) {
            console.log(error);
            console.error('Failed to create connection:', error);
            const errorMessage = `${localeString(
                'views.Settings.NostrWalletConnect.validation.failedToCreateConnection'
            )}: ${error.message}`;
            this.setState({ error: errorMessage });
            NostrWalletConnectStore.setError(true, errorMessage);
        }
    };

    clearErrors = () => {
        this.setState({ error: '' });
        this.props.NostrWalletConnectStore.setError(false);
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
        const { navigation, NostrWalletConnectStore, route } = this.props;
        const {
            loading: storeLoading,
            error: storeError,
            errorMessage: storeErrorMessage
        } = NostrWalletConnectStore;
        const {
            connectionName,
            maxAmountSats,
            selectedBudgetRenewalIndex,
            expiryDays,
            error
        } = this.state;
        const displayError = error || (storeError ? storeErrorMessage : '');
        const budgetButtons: any = getBudgetRenewalOptions().map(
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
                        storeLoading ? (
                            <LoadingIndicator size={20} />
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
                        {displayError && (
                            <ErrorMessage
                                message={displayError}
                                dismissable
                                onPress={this.clearErrors}
                            />
                        )}
                        {/* Connection Name */}
                        <View style={styles.section}>
                            <View style={styles.sectionTitleContainer}>
                                <Body bold>
                                    {localeString(
                                        'views.Settings.NostrWalletConnect.connectionName'
                                    )}
                                </Body>
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

                        {/* Permission Types */}
                        <View style={styles.section}>
                            <View style={styles.sectionTitleContainer}>
                                <Body bold>
                                    {localeString(
                                        'views.Settings.NostrWalletConnect.chooseWalletPermissions'
                                    )}
                                </Body>
                            </View>
                            <View style={{ marginHorizontal: 15 }}>
                                {getPermissionTypes().map(
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
                                    {getAvailablePermissions().map(
                                        this.renderPermissionItem
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Custom Mode Fields */}
                        {this.state.selectedPermissionType === 'custom' && (
                            <>
                                <View style={styles.section}>
                                    <View style={{ marginHorizontal: 15 }}>
                                        <View
                                            style={{
                                                flexDirection: 'row',
                                                marginTop: 10
                                            }}
                                        >
                                            <View
                                                style={{
                                                    flex: 1,
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        color: themeColor(
                                                            'text'
                                                        ),
                                                        fontSize: 17,
                                                        fontFamily:
                                                            'PPNeueMontreal-Book',
                                                        fontWeight: '600'
                                                    }}
                                                >
                                                    {localeString(
                                                        'views.Settings.NostrWalletConnect.isolation'
                                                    )}
                                                </Text>
                                                <Text
                                                    style={{
                                                        color: themeColor(
                                                            'secondaryText'
                                                        ),
                                                        fontSize: 14,
                                                        marginTop: 4,
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    {localeString(
                                                        'views.Settings.NostrWalletConnect.isolationDescription'
                                                    )}
                                                </Text>
                                            </View>
                                            <View
                                                style={{
                                                    alignSelf: 'center',
                                                    marginLeft: 5
                                                }}
                                            >
                                                <Switch
                                                    value={
                                                        this.state.isIsolated
                                                    }
                                                    onValueChange={(
                                                        value: boolean
                                                    ) =>
                                                        this.updateStateWithChangeTracking(
                                                            {
                                                                isIsolated:
                                                                    value
                                                            }
                                                        )
                                                    }
                                                />
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </>
                        )}

                        {/* Budget (Only for Full Access and Custom) */}
                        {(this.state.selectedPermissionType === 'full_access' ||
                            this.state.selectedPermissionType === 'custom') && (
                            <View style={styles.section}>
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
                                        buttons={budgetButtons}
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

                        {/* Connection Expiration (for all except custom) */}
                        {this.state.selectedPermissionType !== 'custom' && (
                            <View style={styles.section}>
                                <View style={styles.sectionTitleContainer}>
                                    <Body bold>
                                        {localeString(
                                            'views.Settings.NostrWalletConnect.connectionExpiration'
                                        )}
                                    </Body>
                                </View>
                                <View
                                    style={styles.sectionDescriptionContainer}
                                >
                                    <Body small color="secondaryText">
                                        {localeString(
                                            'views.Settings.NostrWalletConnect.connectionExpirationDescription'
                                        )}
                                    </Body>
                                </View>
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
                            </View>
                        )}

                        {/* Connection Expiration for Custom */}
                        {this.state.selectedPermissionType === 'custom' && (
                            <View style={styles.section}>
                                <View style={styles.sectionTitleContainer}>
                                    <Body bold>
                                        {localeString(
                                            'views.Settings.NostrWalletConnect.connectionExpiration'
                                        )}
                                    </Body>
                                </View>
                                <View
                                    style={styles.sectionDescriptionContainer}
                                >
                                    <Body small color="secondaryText">
                                        {localeString(
                                            'views.Settings.NostrWalletConnect.connectionExpirationDescription'
                                        )}
                                    </Body>
                                </View>
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
                            </View>
                        )}
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
                                    ? 'Update Connection'
                                    : localeString(
                                          'views.Settings.NostrWalletConnect.createConnection'
                                      )
                            }
                            onPress={this.createConnection}
                            secondary={
                                !this.isFormValid() ||
                                (route.params?.isEdit && !this.state.hasChanges)
                            }
                            disabled={
                                storeLoading ||
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
        marginHorizontal: 10,
        marginVertical: 5
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
