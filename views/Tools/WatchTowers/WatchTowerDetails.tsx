import * as React from 'react';
import { Text, View, StyleSheet, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

import Button from '../../../components/Button';
import Header from '../../../components/Header';
import KeyValue from '../../../components/KeyValue';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Screen from '../../../components/Screen';

import BackendUtils from '../../../utils/BackendUtils';
import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import Base64Utils from '../../../utils/Base64Utils';

interface WatchTowerDetailsProps {
    navigation: StackNavigationProp<any, any>;
    route: RouteProp<
        {
            WatchTowerDetails: {
                watchtower: {
                    pubkey: string;
                    addresses: string[];
                    active_session_candidate: boolean;
                    num_sessions: number;
                    sessions: any[];
                    session_info: any[];
                };
            };
        },
        'WatchTowerDetails'
    >;
}

interface WatchTowerDetailsState {
    loading: boolean;
    error: string;
    watchtowerInfo: any | null;
    confirmDelete: boolean;
    confirmDeactivate: boolean;
    confirmActivate: boolean;
}

@inject()
@observer
export default class WatchTowerDetails extends React.Component<
    WatchTowerDetailsProps,
    WatchTowerDetailsState
> {
    state = {
        loading: false,
        error: '',
        watchtowerInfo: null,
        confirmDelete: false,
        confirmDeactivate: false,
        confirmActivate: false
    };

    async componentDidMount() {
        await this.loadWatchtowerInfo();
    }

    loadWatchtowerInfo = async () => {
        const { route } = this.props;
        const { watchtower } = route.params;
        this.setState({ loading: true, error: '' });
        try {
            const info = await BackendUtils.getWatchtowerInfo(
                watchtower.pubkey
            );
            this.setState({
                watchtowerInfo: info,
                loading: false
            });
        } catch (error: any) {
            console.error('error', error);
            this.setState({
                watchtowerInfo: watchtower,
                loading: false,
                error: error.message || 'Failed to load watchtower details'
            });
        }
    };

    deactivateWatchtower = async () => {
        const { route, navigation } = this.props;
        const { watchtower } = route.params;

        if (!this.state.confirmDeactivate) {
            this.setState({ confirmDeactivate: true });
            return;
        }
        this.setState({ loading: true, error: '', confirmDeactivate: false });

        try {
            await BackendUtils.deactivateWatchtower(watchtower.pubkey);
            navigation.goBack();
        } catch (error: any) {
            console.error('Error deactivating watchtower:', error);
            this.setState({
                loading: false,
                error: error.message || 'Failed to deactivate watchtower'
            });
        }
    };

    activateWatchtower = async () => {
        const { route, navigation } = this.props;
        const { watchtower } = route.params;

        if (!this.state.confirmActivate) {
            this.setState({ confirmActivate: true });
            return;
        }
        this.setState({ loading: true, error: '', confirmActivate: false });

        try {
            await BackendUtils.activateWatchtower({
                pubkey: watchtower.pubkey,
                address: watchtower.addresses[0]
            });
            navigation.goBack();
        } catch (error: any) {
            console.error('Error activating watchtower:', error);
            this.setState({
                loading: false,
                error: error.message || 'Failed to activate watchtower'
            });
        }
    };

    deleteWatchtower = async () => {
        const { route, navigation } = this.props;
        const { watchtower } = route.params;
        if (!this.state.confirmDelete) {
            this.setState({ confirmDelete: true });
            return;
        }
        this.setState({ loading: true, error: '', confirmDelete: false });
        try {
            await BackendUtils.removeWatchtower(watchtower.pubkey);
            navigation.goBack();
        } catch (error: any) {
            console.log('error', error);
            this.setState({
                loading: false,
                error: error.message || 'Failed to delete watchtower'
            });
        }
    };

    render() {
        const { navigation, route } = this.props;
        const { loading, watchtowerInfo } = this.state;
        const { watchtower } = route.params;
        const displayData = watchtowerInfo || watchtower;
        const isActive = displayData.active_session_candidate;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Tools.watchtowers.details'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        loading ? <LoadingIndicator size={30} /> : undefined
                    }
                    navigation={navigation}
                />

                <View style={styles.mainContainer}>
                    <ScrollView
                        style={styles.scrollContainer}
                        contentContainerStyle={styles.scrollContent}
                    >
                        <View style={styles.infoSection}>
                            <KeyValue
                                keyValue={localeString(
                                    'views.Transaction.status'
                                )}
                                value={
                                    displayData.active_session_candidate
                                        ? localeString(
                                              'views.Tools.watchtowers.active'
                                          )
                                        : localeString(
                                              'views.Tools.watchtowers.inactive'
                                          )
                                }
                                valueIndicatorColor={
                                    displayData.active_session_candidate
                                        ? themeColor('success')
                                        : themeColor('error')
                                }
                                sensitive
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.Tools.watchtowers.pubkey'
                                )}
                                value={Base64Utils.base64ToHex(
                                    displayData.pubkey
                                )}
                                sensitive
                            />

                            <KeyValue
                                keyValue={localeString(
                                    'views.Tools.watchtowers.sessions'
                                )}
                                value={`${displayData.num_sessions || 0}`}
                                color={
                                    displayData.num_sessions > 0
                                        ? themeColor('success')
                                        : themeColor('secondaryText')
                                }
                            />

                            <KeyValue
                                keyValue={localeString(
                                    'views.Tools.watchtowers.addresses'
                                )}
                                value={displayData.addresses.join('\n')}
                                sensitive
                            />

                            <KeyValue
                                keyValue={localeString(
                                    'views.Tools.watchtowers.activeCandidate'
                                )}
                                value={
                                    displayData.active_session_candidate
                                        ? localeString('general.true')
                                        : localeString('general.false')
                                }
                                color={
                                    displayData.active_session_candidate
                                        ? themeColor('success')
                                        : themeColor('error')
                                }
                            />
                        </View>

                        {/* Session Info - Only show if there are sessions */}
                        {displayData.session_info &&
                            displayData.session_info.length > 0 &&
                            displayData.num_sessions > 0 && (
                                <View style={styles.sessionSection}>
                                    <Text
                                        style={[
                                            styles.sectionTitle,
                                            { color: themeColor('text') }
                                        ]}
                                    >
                                        {localeString(
                                            'views.Tools.watchtowers.sessionInfo'
                                        )}
                                    </Text>
                                    {displayData.session_info.map(
                                        (session: any, index: number) => (
                                            <View
                                                key={index}
                                                style={styles.sessionItem}
                                            >
                                                <KeyValue
                                                    keyValue={localeString(
                                                        'views.Tools.watchtowers.policyType'
                                                    )}
                                                    value={
                                                        session.policy_type ||
                                                        'N/A'
                                                    }
                                                />
                                                <KeyValue
                                                    keyValue={localeString(
                                                        'views.Tools.watchtowers.numSessions'
                                                    )}
                                                    value={`${
                                                        session.num_sessions ||
                                                        0
                                                    }`}
                                                />
                                            </View>
                                        )
                                    )}
                                </View>
                            )}
                    </ScrollView>

                    <View style={styles.buttonContainer}>
                        {isActive ? (
                            <Button
                                title={
                                    this.state.confirmDeactivate
                                        ? localeString(
                                              'views.Settings.AddEditNode.tapToConfirm'
                                          )
                                        : localeString(
                                              'views.Tools.watchtowers.deactivate'
                                          )
                                }
                                onPress={this.deactivateWatchtower}
                                disabled={loading}
                                containerStyle={styles.button}
                                buttonStyle={{
                                    backgroundColor: themeColor('secondary'),
                                    borderRadius: 8
                                }}
                                titleStyle={{
                                    color: themeColor('text')
                                }}
                            />
                        ) : (
                            <Button
                                title={
                                    this.state.confirmActivate
                                        ? localeString(
                                              'views.Settings.AddEditNode.tapToConfirm'
                                          )
                                        : localeString('general.activate')
                                }
                                onPress={this.activateWatchtower}
                                disabled={loading}
                                containerStyle={styles.button}
                                buttonStyle={{
                                    backgroundColor: themeColor('secondary'),
                                    borderRadius: 8
                                }}
                                titleStyle={{
                                    color: themeColor('success')
                                }}
                            />
                        )}

                        <Button
                            title={
                                this.state.confirmDelete
                                    ? localeString(
                                          'views.Settings.AddEditNode.tapToConfirm'
                                      )
                                    : localeString('general.delete')
                            }
                            onPress={this.deleteWatchtower}
                            disabled={loading}
                            containerStyle={styles.button}
                            buttonStyle={{
                                backgroundColor: themeColor('delete')
                            }}
                            warning
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
        paddingLeft: 20,
        paddingRight: 20,
        paddingBottom: 20
    },
    container: {
        flex: 1,
        paddingLeft: 20,
        paddingRight: 20
    },
    statusContainer: {
        alignItems: 'center',
        marginBottom: 24,
        padding: 16,
        borderRadius: 8
    },
    statusContent: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    statusIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 10
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'PPNeueMontreal-Book'
    },
    infoSection: {
        marginBottom: 24
    },
    sessionSection: {
        marginBottom: 24
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 16,
        fontFamily: 'PPNeueMontreal-Book'
    },
    sessionItem: {
        marginBottom: 16,
        padding: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.03)'
    },
    buttonContainer: {
        padding: 20,
        paddingTop: 10,
        gap: 12
    },
    button: {
        marginHorizontal: 0
    }
});
