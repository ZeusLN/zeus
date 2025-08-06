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

interface AddNWCConnectionProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'AddNWCConnection',
        { connectionId?: string; isEdit?: boolean }
    >;
    SettingsStore: SettingsStore;
    NostrWalletConnectStore: NostrWalletConnectStore;
}

interface AddNWCConnectionState {
    connectionName: string;
    selectedPermissions: string[];
    maxAmountSats: string;
    selectedBudgetRenewalIndex: number;
    expiryDays: string;
    description: string;
    error: string;
    originalConnection: NWCConnection | null;
    hasChanges: boolean;
    selectedPermissionType: 'full_access' | 'read_only' | 'isolated' | 'custom';
    isIsolated: boolean;
}

const availablePermissions = [
    {
        key: 'get_info',
        title: localeString(
            'views.Settings.NostrWalletConnect.permissions.getInfo'
        ),
        description: localeString(
            'views.Settings.NostrWalletConnect.permissions.getInfoDescription'
        )
    },
    {
        key: 'get_balance',
        title: localeString(
            'views.Settings.NostrWalletConnect.permissions.getBalance'
        ),
        description: localeString(
            'views.Settings.NostrWalletConnect.permissions.getBalanceDescription'
        )
    },
    {
        key: 'pay_invoice',
        title: localeString(
            'views.Settings.NostrWalletConnect.permissions.payInvoice'
        ),
        description: localeString(
            'views.Settings.NostrWalletConnect.permissions.payInvoiceDescription'
        )
    },
    {
        key: 'make_invoice',
        title: localeString(
            'views.Settings.NostrWalletConnect.permissions.makeInvoice'
        ),
        description: localeString(
            'views.Settings.NostrWalletConnect.permissions.makeInvoiceDescription'
        )
    },
    {
        key: 'lookup_invoice',
        title: localeString(
            'views.Settings.NostrWalletConnect.permissions.lookupInvoice'
        ),
        description: localeString(
            'views.Settings.NostrWalletConnect.permissions.lookupInvoiceDescription'
        )
    },
    {
        key: 'list_transactions',
        title: localeString(
            'views.Settings.NostrWalletConnect.permissions.listTransactions'
        ),
        description: localeString(
            'views.Settings.NostrWalletConnect.permissions.listTransactionsDescription'
        )
    },
    {
        key: 'pay_keysend',
        title: localeString(
            'views.Settings.NostrWalletConnect.permissions.payKeysend'
        ),
        description: localeString(
            'views.Settings.NostrWalletConnect.permissions.payKeysendDescription'
        )
    }
];

const budgetRenewalOptions = [
    {
        key: 'never',
        title: localeString(
            'views.Settings.NostrWalletConnect.budgetRenewal.never'
        )
    },
    {
        key: 'daily',
        title: localeString(
            'views.Settings.NostrWalletConnect.budgetRenewal.daily'
        )
    },
    {
        key: 'weekly',
        title: localeString(
            'views.Settings.NostrWalletConnect.budgetRenewal.weekly'
        )
    },
    {
        key: 'monthly',
        title: localeString(
            'views.Settings.NostrWalletConnect.budgetRenewal.monthly'
        )
    },
    {
        key: 'yearly',
        title: localeString(
            'views.Settings.NostrWalletConnect.budgetRenewal.yearly'
        )
    }
];

const permissionTypes = [
    {
        key: 'full_access',
        title: localeString('views.Settings.NostrWalletConnect.fullAccess'),
        description: localeString(
            'views.Settings.NostrWalletConnect.fullAccessDescription'
        )
    },
    {
        key: 'read_only',
        title: localeString('views.Settings.NostrWalletConnect.readOnly'),
        description: localeString(
            'views.Settings.NostrWalletConnect.readOnlyDescription'
        )
    },
    {
        key: 'isolated',
        title: localeString('views.Settings.NostrWalletConnect.isolated'),
        description: localeString(
            'views.Settings.NostrWalletConnect.isolatedDescription'
        )
    },
    {
        key: 'custom',
        title: localeString('views.Settings.NostrWalletConnect.custom'),
        description: localeString(
            'views.Settings.NostrWalletConnect.customDescription'
        )
    }
];

@inject('SettingsStore', 'NostrWalletConnectStore')
@observer
export default class AddNWCConnection extends React.Component<
    AddNWCConnectionProps,
    AddNWCConnectionState
> {
    constructor(props: AddNWCConnectionProps) {
        super(props);
        this.state = {
            connectionName: '',
            selectedPermissions: ['get_info', 'get_balance', 'pay_invoice'], // default permissions
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
            const budgetRenewalIndex = budgetRenewalOptions.findIndex(
                (option) => option.key === connection.budgetRenewal
            );
            let expiryDays = '';
            if (connection.expiresAt) {
                const now = new Date();
                const expiry = new Date(connection.expiresAt);
                const diffTime = expiry.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                expiryDays = diffDays > 0 ? diffDays.toString() : '';
            }

            this.setState({
                connectionName: connection.name,
                selectedPermissions: connection.permissions,
                maxAmountSats: connection.maxAmountSats?.toString() || '',
                selectedBudgetRenewalIndex:
                    budgetRenewalIndex >= 0 ? budgetRenewalIndex : 0,
                expiryDays,
                description: connection.description || '',
                originalConnection: connection,
                hasChanges: false
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
            budgetRenewalOptions[this.state.selectedBudgetRenewalIndex]?.key ||
            'never';
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

        return (
            nameChanged ||
            permissionsChanged ||
            maxAmountChanged ||
            budgetRenewalChanged ||
            expiryChanged
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

    selectPermissionType = (
        permissionType: 'full_access' | 'read_only' | 'isolated' | 'custom'
    ) => {
        let newPermissions: string[] = [];
        let isIsolated = false;

        switch (permissionType) {
            case 'full_access':
                newPermissions = [
                    'get_info',
                    'get_balance',
                    'pay_invoice',
                    'make_invoice',
                    'lookup_invoice',
                    'list_transactions',
                    'pay_keysend'
                ];
                isIsolated = false;
                break;
            case 'read_only':
                newPermissions = [
                    'get_info',
                    'get_balance',
                    'make_invoice',
                    'lookup_invoice',
                    'list_transactions'
                ];
                isIsolated = false;
                break;
            case 'isolated':
                newPermissions = [
                    'get_info',
                    'get_balance',
                    'make_invoice',
                    'lookup_invoice',
                    'list_transactions'
                ];
                isIsolated = true;
                break;
            case 'custom':
                // Keep current permissions for custom mode
                newPermissions = this.state.selectedPermissions;
                isIsolated = this.state.isIsolated;
                break;
        }

        this.updateStateWithChangeTracking({
            selectedPermissionType: permissionType,
            selectedPermissions: newPermissions,
            isIsolated
        });
    };

    togglePermission = (permission: string) => {
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
            expiryDays
        } = this.state;
        const { NostrWalletConnectStore, route } = this.props;
        const { connectionId, isEdit } = route.params ?? {};

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
                budgetRenewalOptions[selectedBudgetRenewalIndex].key;
            const params: any = {
                name: connectionName.trim(),
                permissions: selectedPermissions,
                budgetRenewal
            };

            if (maxAmountSats) {
                const budget = parseInt(maxAmountSats, 10);
                if (isNaN(budget) || budget <= 0) {
                    this.setState({
                        error: localeString(
                            'views.Settings.NostrWalletConnect.validation.budgetAmountInvalid'
                        )
                    });
                    return;
                }
                params.maxAmountSats = budget;
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
                    this.props.navigation.navigate('ConnectionQR', {
                        connectionId: createdConnection.id,
                        nostrUrl
                    });
                }
            }
        } catch (error: any) {
            console.error('Failed to create connection:', error);
            this.setState({
                error: `${localeString(
                    'views.Settings.NostrWalletConnect.validation.failedToCreateConnection'
                )}: ${error.message}`
            });
        }
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
        const { loading: storeLoading } = NostrWalletConnectStore;
        const {
            connectionName,
            maxAmountSats,
            selectedBudgetRenewalIndex,
            expiryDays
        } = this.state;

        const budgetButtons: any = budgetRenewalOptions.map(
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
                        {this.state.error && (
                            <ErrorMessage
                                message={this.state.error}
                                dismissable
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
                                {permissionTypes.map(
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
                                    {availablePermissions.map(
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
                            buttonStyle={{
                                ...styles.createButton,
                                backgroundColor:
                                    route.params?.isEdit &&
                                    !this.state.hasChanges
                                        ? themeColor('secondary')
                                        : themeColor('highlight')
                            }}
                            titleStyle={{
                                color:
                                    route.params?.isEdit &&
                                    !this.state.hasChanges
                                        ? themeColor('secondaryText')
                                        : themeColor('background'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 16,
                                fontWeight: '600'
                            }}
                            disabled={
                                storeLoading ||
                                (route.params?.isEdit && !this.state.hasChanges)
                            }
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
        marginTop: 15,
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
    },
    createButton: {
        borderRadius: 12,
        paddingVertical: 12,
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3
    }
});
