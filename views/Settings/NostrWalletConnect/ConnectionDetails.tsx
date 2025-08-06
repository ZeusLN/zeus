import React from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Text
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import { Body } from '../../../components/text/Body';
import Button from '../../../components/Button';
import LoadingIndicator from '../../../components/LoadingIndicator';
import KeyValue from '../../../components/KeyValue';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';

import SettingsStore from '../../../stores/SettingsStore';
import NostrWalletConnectStore from '../../../stores/NostrWalletConnectStore';
import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';
import NWCConnection from '../../../models/NWCConnection';
import EditIcon from '../../../assets/images/SVG/Edit.svg';
import Checkmark from '../../../assets/images/SVG/Checkmark.svg';

interface ConnectionDetailsProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'ConnectionDetails', { connectionId: string }>;
    SettingsStore: SettingsStore;
    NostrWalletConnectStore: NostrWalletConnectStore;
}

interface ConnectionDetailsState {
    loading: boolean;
    confirmDelete: boolean;
    error: string | null;
}

@inject('SettingsStore', 'NostrWalletConnectStore')
@observer
export default class ConnectionDetails extends React.Component<
    ConnectionDetailsProps,
    ConnectionDetailsState
> {
    private unsubscribeFocus?: () => void;
    constructor(props: ConnectionDetailsProps) {
        super(props);
        this.state = {
            loading: false,
            confirmDelete: false,
            error: null
        };
    }

    componentDidMount() {
        const { route, navigation } = this.props;
        const connectionId = route.params?.connectionId;
        if (!connectionId) {
            navigation.goBack();
            return;
        }
        this.unsubscribeFocus = navigation.addListener('focus', () => {
            this.forceUpdate();
        });
    }

    componentWillUnmount() {
        if (this.unsubscribeFocus) {
            this.unsubscribeFocus();
        }
    }

    getConnection = (): NWCConnection | undefined => {
        const { route, NostrWalletConnectStore } = this.props;
        const connectionId = route.params?.connectionId;
        if (!connectionId) return undefined;

        const connection = NostrWalletConnectStore.getConnection(connectionId);

        if (connection) {
            connection.name;
            connection.permissions;
            connection.maxAmountSats;
            connection.budgetRenewal;
            connection.expiresAt;
        }

        return connection;
    };

    formatDate = (date: Date) => {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return localeString('views.Settings.NostrWalletConnect.today');
        } else if (diffDays === 1) {
            return localeString('views.Settings.NostrWalletConnect.yesterday');
        } else if (diffDays < 7) {
            return `${diffDays} ${localeString(
                'views.Settings.NostrWalletConnect.daysAgo'
            )}`;
        } else {
            return date.toLocaleDateString();
        }
    };

    getAllPermissions = () => {
        return [
            'get_info',
            'get_balance',
            'pay_invoice',
            'make_invoice',
            'lookup_invoice',
            'list_transactions',
            'pay_keysend'
        ];
    };

    getPermissionDescription = (permission: string) => {
        const descriptions: { [key: string]: string } = {
            get_info: 'Read your node info',
            get_balance: 'Read your balance',
            pay_invoice: 'Pay lightning invoices',
            make_invoice: 'Create invoices',
            lookup_invoice: 'Lookup status of invoices',
            list_transactions: 'Read transaction history',
            pay_keysend: 'Send keysend payments'
        };
        return descriptions[permission] || permission.replace(/_/g, ' ');
    };
    editConnection = (connection: NWCConnection) => {
        this.props.navigation.navigate('AddNWCConnection', {
            connectionId: connection.id,
            isEdit: true
        });
    };
    deleteConnection = (connection: NWCConnection) => {
        const { NostrWalletConnectStore, navigation } = this.props;
        if (!this.state.confirmDelete) {
            this.setState({ confirmDelete: true });
            setTimeout(() => {
                this.setState({ confirmDelete: false });
            }, 3000);
        } else {
            this.setState({ loading: true, error: '' });
            NostrWalletConnectStore.deleteConnection(connection.id)
                .then(() => {
                    navigation.goBack();
                })
                .catch((error) => {
                    console.error('Failed to delete connection:', error);
                    this.setState({
                        error: 'Failed to delete connection',
                        loading: false,
                        confirmDelete: false
                    });
                });
        }
    };

    render() {
        const { navigation, NostrWalletConnectStore } = this.props;
        const { loading, error } = this.state;
        const { loading: storeLoading } = NostrWalletConnectStore;
        const connection = this.getConnection();

        if (!connection) {
            return (
                <Screen>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.NostrWalletConnect.connectionDetails'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                </Screen>
            );
        }

        if (loading) {
            return (
                <Screen>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: connection.name,
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <View style={styles.loadingContainer}>
                        <LoadingIndicator />
                    </View>
                </Screen>
            );
        }

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: connection.name,
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        loading || storeLoading ? (
                            <LoadingIndicator size={20} />
                        ) : (
                            <TouchableOpacity
                                onPress={() => this.editConnection(connection)}
                                style={styles.headerActionButton}
                            >
                                <EditIcon
                                    fill={themeColor('text')}
                                    width={20}
                                    height={20}
                                />
                            </TouchableOpacity>
                        )
                    }
                    navigation={navigation}
                />

                {error ? (
                    <ErrorMessage message={error} dismissable />
                ) : (
                    <View style={{ flex: 1 }}>
                        <ScrollView
                            style={styles.container}
                            showsVerticalScrollIndicator={false}
                        >
                            <View>
                                <View style={styles.section}>
                                    <View style={styles.sectionTitle}>
                                        <Text
                                            style={{
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.NostrWalletConnect.connectionDetails'
                                            )}
                                        </Text>
                                    </View>

                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Settings.NostrWalletConnect.created'
                                        )}
                                        value={this.formatDate(
                                            connection.createdAt
                                        )}
                                    />

                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Settings.NostrWalletConnect.lastUsed'
                                        )}
                                        value={
                                            connection.lastUsed
                                                ? this.formatDate(
                                                      connection.lastUsed
                                                  )
                                                : localeString(
                                                      'views.Settings.NostrWalletConnect.never'
                                                  )
                                        }
                                    />

                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Settings.NostrWalletConnect.budget'
                                        )}
                                        value={`${
                                            connection.maxAmountSats?.toLocaleString() ??
                                            localeString(
                                                'views.Settings.NostrWalletConnect.unlimited'
                                            )
                                        } sats${
                                            connection.budgetRenewal !== 'never'
                                                ? ` (${connection.budgetRenewal})`
                                                : ''
                                        }`}
                                    />

                                    {connection.expiresAt && (
                                        <KeyValue
                                            keyValue={localeString(
                                                'views.Settings.NostrWalletConnect.expires'
                                            )}
                                            value={this.formatDate(
                                                connection.expiresAt
                                            )}
                                        />
                                    )}

                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Settings.NostrWalletConnect.connectionId'
                                        )}
                                        value={connection.id}
                                    />

                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Settings.NostrWalletConnect.publicKey'
                                        )}
                                        value={connection.pubkey}
                                    />

                                    {connection.description && (
                                        <KeyValue
                                            keyValue={localeString(
                                                'views.Settings.NostrWalletConnect.description'
                                            )}
                                            value={connection.description}
                                        />
                                    )}
                                </View>
                                <View style={styles.section}>
                                    <View style={styles.sectionTitle}>
                                        <Body bold>
                                            {localeString(
                                                'views.Settings.NostrWalletConnect.permissions'
                                            )}
                                        </Body>
                                        <Body>
                                            ({connection.permissions.length} of{' '}
                                            {this.getAllPermissions().length})
                                        </Body>
                                    </View>

                                    <View style={styles.permissionsList}>
                                        {this.getAllPermissions().map(
                                            (permission, index) => {
                                                const isActive =
                                                    connection.permissions.includes(
                                                        permission
                                                    );
                                                return (
                                                    <View
                                                        key={index}
                                                        style={
                                                            styles.permissionItem
                                                        }
                                                    >
                                                        <Checkmark
                                                            fill={
                                                                isActive
                                                                    ? themeColor(
                                                                          'success'
                                                                      )
                                                                    : themeColor(
                                                                          'secondaryText'
                                                                      )
                                                            }
                                                            width={16}
                                                            height={16}
                                                            style={
                                                                styles.permissionIcon
                                                            }
                                                        />
                                                        <Text
                                                            style={[
                                                                styles.permissionText,

                                                                {
                                                                    color: isActive
                                                                        ? themeColor(
                                                                              'text'
                                                                          )
                                                                        : themeColor(
                                                                              'secondaryText'
                                                                          )
                                                                }
                                                            ]}
                                                        >
                                                            {this.getPermissionDescription(
                                                                permission
                                                            )}
                                                        </Text>
                                                    </View>
                                                );
                                            }
                                        )}
                                    </View>
                                </View>
                            </View>
                        </ScrollView>

                        <View
                            style={[
                                styles.bottomContainer,
                                { backgroundColor: themeColor('background') }
                            ]}
                        >
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
                                onPress={() =>
                                    this.deleteConnection(connection)
                                }
                                containerStyle={{
                                    borderColor: themeColor('delete')
                                }}
                                buttonStyle={{
                                    backgroundColor: this.state.confirmDelete
                                        ? themeColor('warning')
                                        : themeColor('delete')
                                }}
                                titleStyle={{
                                    color: themeColor('text')
                                }}
                            />
                        </View>
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 10
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerActionButton: {
        padding: 8
    },
    section: {
        marginBottom: 15
    },
    sectionTitle: {
        flexDirection: 'row',
        gap: 4,
        marginBottom: 12
    },
    permissionsList: {
        flex: 1,
        marginTop: 6
    },
    permissionItem: {
        paddingVertical: 10,
        marginBottom: 4,
        borderRadius: 10,
        marginTop: 4,
        flexDirection: 'row',
        alignItems: 'center'
    },
    permissionIcon: {
        marginRight: 8
    },
    permissionText: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book',
        textTransform: 'capitalize',
        fontWeight: '500'
    },
    bottomContainer: {
        paddingHorizontal: 20,
        paddingVertical: 15
    }
});
