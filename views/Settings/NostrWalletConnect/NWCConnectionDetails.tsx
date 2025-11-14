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

import DateTimeUtils from '../../../utils/DateTimeUtils';
import NostrConnectUtils from '../../../utils/NostrConnectUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';

import NostrWalletConnectStore from '../../../stores/NostrWalletConnectStore';

import NWCConnection from '../../../models/NWCConnection';
import EditIcon from '../../../assets/images/SVG/Edit.svg';
import Checkmark from '../../../assets/images/SVG/Checkmark.svg';

interface NWCConnectionDetailsProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'NWCConnectionDetails', { connectionId: string }>;
    NostrWalletConnectStore: NostrWalletConnectStore;
}

interface NWCConnectionDetailsState {
    loading: boolean;
    connection: NWCConnection | null;
    confirmDelete: boolean;
    error: string | null;
}

@inject('NostrWalletConnectStore')
@observer
export default class NWCConnectionDetails extends React.Component<
    NWCConnectionDetailsProps,
    NWCConnectionDetailsState
> {
    private unsubscribeFocus?: () => void;
    constructor(props: NWCConnectionDetailsProps) {
        super(props);
        this.state = {
            loading: false,
            connection: null,
            confirmDelete: false,
            error: null
        };
    }

    componentDidMount() {
        const { navigation } = this.props;
        this.unsubscribeFocus = navigation.addListener(
            'focus',
            this.loadConnection
        );
    }

    loadConnection = async () => {
        const { NostrWalletConnectStore } = this.props;
        const { connectionId } = this.props.route.params;
        if (!connectionId) {
            this.setState({
                loading: false,
                error: localeString(
                    'stores.NostrWalletConnectStore.error.connectionNotFound'
                )
            });
            return;
        }
        this.setState({ loading: true });
        try {
            await NostrWalletConnectStore.loadConnections();
            const connection =
                NostrWalletConnectStore.getConnection(connectionId);
            if (connection) {
                this.setState({ connection, loading: false });
            } else {
                this.setState({
                    loading: false,
                    error: localeString(
                        'stores.NostrWalletConnectStore.error.connectionNotFound'
                    )
                });
            }
        } catch (error) {
            console.error('Failed to load connection:', error);
            this.setState({ loading: false });
        }
    };

    componentWillUnmount() {
        if (this.unsubscribeFocus) {
            this.unsubscribeFocus();
        }
    }

    editConnection = (connectionId: string) => {
        this.props.navigation.navigate('AddOrEditNWCConnection', {
            connectionId,
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
        const { loading, error, connection } = this.state;
        const { loading: storeLoading } = NostrWalletConnectStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={
                        connection
                            ? {
                                  text: connection?.name,
                                  style: {
                                      color: themeColor('text'),
                                      fontFamily: 'PPNeueMontreal-Book'
                                  }
                              }
                            : undefined
                    }
                    rightComponent={
                        loading || storeLoading ? (
                            <View style={{ marginRight: 10 }}>
                                <LoadingIndicator size={30} />
                            </View>
                        ) : (
                            <View style={styles.headerActions}>
                                <TouchableOpacity
                                    onPress={() =>
                                        this.editConnection(
                                            connection?.id ?? ''
                                        )
                                    }
                                    style={styles.headerActionButton}
                                >
                                    <EditIcon
                                        fill={themeColor('text')}
                                        width={20}
                                        height={20}
                                    />
                                </TouchableOpacity>
                            </View>
                        )
                    }
                    navigation={navigation}
                />

                {error ? (
                    <ErrorMessage
                        message={
                            error ||
                            localeString(
                                'stores.NostrWalletConnectStore.error.connectionNotFound'
                            )
                        }
                        dismissable
                    />
                ) : connection ? (
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
                                            'views.Transaction.status'
                                        )}
                                        valueIndicatorColor={
                                            connection.isExpired
                                                ? themeColor('delete')
                                                : themeColor('success')
                                        }
                                        value={
                                            connection.isExpired
                                                ? localeString(
                                                      'channel.expirationStatus.expired'
                                                  )
                                                : localeString('general.active')
                                        }
                                    />

                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Settings.NostrWalletConnect.created'
                                        )}
                                        value={DateTimeUtils.listFormattedDateOrder(
                                            connection.createdAt
                                        )}
                                    />

                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Settings.NostrWalletConnect.lastUsed'
                                        )}
                                        value={
                                            connection.lastUsed
                                                ? DateTimeUtils.listFormattedDateOrder(
                                                      connection.lastUsed
                                                  )
                                                : localeString(
                                                      'models.Invoice.never'
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
                                        } ${localeString('general.sats')}${
                                            connection.budgetRenewal !== 'never'
                                                ? ` (${connection.budgetRenewal})`
                                                : ''
                                        }`}
                                    />

                                    {connection.maxAmountSats && (
                                        <>
                                            <KeyValue
                                                keyValue={localeString(
                                                    'views.Settings.NostrWalletConnect.totalSpent'
                                                )}
                                                value={`${connection.totalSpendSats.toLocaleString()} ${localeString(
                                                    'general.sats'
                                                )}`}
                                            />

                                            <KeyValue
                                                keyValue={localeString(
                                                    'views.Settings.NostrWalletConnect.remainingBudget'
                                                )}
                                                value={`${connection.remainingBudget.toLocaleString()} ${localeString(
                                                    'general.sats'
                                                )}`}
                                            />
                                        </>
                                    )}

                                    {connection.expiresAt && (
                                        <KeyValue
                                            keyValue={localeString(
                                                'general.expiresAt'
                                            )}
                                            value={DateTimeUtils.formatDate(
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
                                    <KeyValue
                                        keyValue={localeString(
                                            'nostr.relayUrl'
                                        )}
                                        value={connection.relayUrl}
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
                                            {
                                                NostrConnectUtils.getFullAccessPermissions()
                                                    .length
                                            }
                                            )
                                        </Body>
                                    </View>

                                    <View style={styles.permissionsList}>
                                        {NostrConnectUtils.getFullAccessPermissions()
                                            .sort((a, b) => {
                                                const aActive =
                                                    connection.permissions.includes(
                                                        a
                                                    );
                                                const bActive =
                                                    connection.permissions.includes(
                                                        b
                                                    );
                                                if (aActive && !bActive)
                                                    return -1;
                                                if (!aActive && bActive)
                                                    return 1;
                                                return 0;
                                            })
                                            .map((permission, index) => {
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
                                                        <View
                                                            style={{
                                                                opacity:
                                                                    isActive
                                                                        ? 1
                                                                        : 0.3
                                                            }}
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
                                                        </View>
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
                                                            {NostrConnectUtils.getPermissionShortDescription(
                                                                permission
                                                            )}
                                                        </Text>
                                                    </View>
                                                );
                                            })}
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
                                              'views.Settings.NostrWalletConnect.deleteConnection'
                                          )
                                }
                                onPress={() =>
                                    this.deleteConnection(connection)
                                }
                                warning={!this.state.confirmDelete}
                                containerStyle={{
                                    borderColor: this.state.confirmDelete
                                        ? themeColor('warning')
                                        : themeColor('delete')
                                }}
                                noUppercase
                            />
                        </View>
                    </View>
                ) : null}
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
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center'
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
