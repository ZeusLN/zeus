import React from 'react';
import { Text, View, StyleSheet, ScrollView } from 'react-native';
import { observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

import Button from '../../../components/Button';
import Header from '../../../components/Header';
import KeyValue from '../../../components/KeyValue';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Screen from '../../../components/Screen';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';

import BackendUtils from '../../../utils/BackendUtils';
import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import Base64Utils from '../../../utils/Base64Utils';
import { Watchtower } from './WatchtowerList';

interface WatchtowerDetailsProps {
    navigation: StackNavigationProp<any, any>;
    route: RouteProp<
        {
            WatchtowerDetails: {
                watchtower: Watchtower;
            };
        },
        'WatchtowerDetails'
    >;
}

interface WatchtowerDetailsState {
    loading: boolean;
    error: string | null;
    watchtowerInfo: Watchtower | null;
    confirmDelete: boolean;
    confirmDeactivate: boolean;
    confirmActivate: boolean;
}

@observer
export default class WatchtowerDetails extends React.Component<
    WatchtowerDetailsProps,
    WatchtowerDetailsState
> {
    state = {
        loading: false,
        error: null,
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
        this.setState({ loading: true, error: null });
        try {
            const info = await BackendUtils.getWatchtowerInfo(
                watchtower.pubkey
            );
            this.setState({
                watchtowerInfo: info,
                loading: false
            });
        } catch (error: any) {
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
        this.setState({ loading: true, error: null, confirmDeactivate: false });

        try {
            await BackendUtils.deactivateWatchtower(watchtower.pubkey);
            navigation.goBack();
        } catch (error: any) {
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
        this.setState({ loading: true, error: null, confirmActivate: false });
        try {
            await BackendUtils.addWatchtower({
                pubkey: Base64Utils.base64ToHex(watchtower.pubkey),
                address: watchtower.addresses[0]
            });
            navigation.goBack();
        } catch (error: any) {
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
        this.setState({ loading: true, error: null, confirmDelete: false });
        try {
            await BackendUtils.removeWatchtower(watchtower.pubkey);
            navigation.goBack();
        } catch (error: any) {
            this.setState({
                loading: false,
                error: error.message || 'Failed to delete watchtower'
            });
        }
    };

    render() {
        const { navigation, route } = this.props;
        const { loading, watchtowerInfo, error } = this.state;
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
                    {error && <ErrorMessage message={error} />}
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
                                        ? localeString('general.active')
                                        : localeString('general.inactive')
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
                                    'views.Settings.AddContact.pubkey'
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
                            Array.isArray(displayData.session_info) &&
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
                                                style={{
                                                    marginBottom: 10,
                                                    backgroundColor:
                                                        themeColor('secondary'),
                                                    padding: 16,
                                                    borderRadius: 8
                                                }}
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
                                        : localeString('general.deactivate')
                                }
                                onPress={this.deactivateWatchtower}
                                disabled={loading}
                                secondary
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
                                secondary
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
    infoSection: {
        marginBottom: 24
    },
    sessionSection: {
        marginBottom: 24
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '400',
        marginBottom: 16,
        fontFamily: 'PPNeueMontreal-Book'
    },
    buttonContainer: {
        padding: 20,
        paddingTop: 10,
        gap: 12
    }
});
