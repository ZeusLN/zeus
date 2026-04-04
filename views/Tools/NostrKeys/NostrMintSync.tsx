import * as React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../../components/Button';
import Header from '../../../components/Header';
import KeyValue from '../../../components/KeyValue';
import Screen from '../../../components/Screen';
import Text from '../../../components/Text';
import LoadingIndicator from '../../../components/LoadingIndicator';
import {
    SuccessMessage,
    ErrorMessage
} from '../../../components/SuccessErrorMessage';
import CashuStore from '../../../stores/CashuStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

interface NostrMintSyncProps {
    navigation: NativeStackNavigationProp<any, any>;
    CashuStore: CashuStore;
}

interface NostrMintSyncState {
    loading: boolean;
    backupSuccess: boolean;
    backupError: boolean;
    restoreError: boolean;
}

@inject('CashuStore')
@observer
export default class NostrMintSync extends React.Component<
    NostrMintSyncProps,
    NostrMintSyncState
> {
    constructor(props: NostrMintSyncProps) {
        super(props);

        this.state = {
            loading: false,
            backupSuccess: false,
            backupError: false,
            restoreError: false
        };
    }

    handleBackup = async () => {
        this.setState({
            loading: true,
            backupSuccess: false,
            backupError: false
        });

        try {
            await this.props.CashuStore.nostrBackupMints();
            this.setState({ loading: false, backupSuccess: true });
        } catch (e) {
            this.setState({ loading: false, backupError: true });
        }
    };

    handleRestore = async () => {
        this.setState({
            loading: true,
            restoreError: false
        });

        try {
            const mints = await this.props.CashuStore.nostrRestoreMints();
            if (mints && mints.length > 0) {
                this.setState({ loading: false });

                // Prompt user to add discovered mints
                const currentMints = this.props.CashuStore.mintUrls;
                const newMints = mints.filter((m) => !currentMints.includes(m));

                if (newMints.length > 0) {
                    Alert.alert(
                        localeString('views.Tools.NostrKeys.mintsFound'),
                        newMints.join('\n'),
                        [
                            {
                                text: localeString('general.cancel'),
                                style: 'cancel'
                            },
                            {
                                text: localeString('general.add'),
                                onPress: async () => {
                                    for (const mint of newMints) {
                                        await this.props.CashuStore.addMint(
                                            mint,
                                            true
                                        );
                                    }
                                }
                            }
                        ]
                    );
                } else {
                    Alert.alert(
                        localeString('views.Tools.NostrKeys.noNewMints'),
                        localeString(
                            'views.Tools.NostrKeys.allMintsAlreadyAdded'
                        )
                    );
                }
            } else {
                this.setState({ loading: false, restoreError: true });
            }
        } catch (e) {
            this.setState({ loading: false, restoreError: true });
        }
    };

    render() {
        const { navigation, CashuStore } = this.props;
        const { loading, backupSuccess, backupError, restoreError } =
            this.state;
        const { nostrMintBackupTimestamp } = CashuStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Tools.NostrMintSync.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        rightComponent={
                            loading ? (
                                <View style={{ marginRight: 10 }}>
                                    <LoadingIndicator size={24} />
                                </View>
                            ) : undefined
                        }
                        navigation={navigation}
                    />
                    {backupSuccess && (
                        <SuccessMessage
                            message={localeString(
                                'views.Tools.NostrKeys.backupSuccess'
                            )}
                            dismissable
                        />
                    )}
                    {backupError && (
                        <ErrorMessage
                            message={localeString(
                                'views.Tools.NostrKeys.backupError'
                            )}
                            dismissable
                        />
                    )}
                    {restoreError && (
                        <ErrorMessage
                            message={localeString(
                                'views.Tools.NostrKeys.restoreError'
                            )}
                            dismissable
                        />
                    )}
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{
                            paddingHorizontal: 15,
                            paddingBottom: 15
                        }}
                    >
                        <Text
                            style={{
                                ...styles.description,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString(
                                'views.Tools.NostrMintSync.description'
                            )}
                        </Text>

                        {nostrMintBackupTimestamp && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Tools.NostrKeys.lastBackup'
                                )}
                                value={new Date(
                                    nostrMintBackupTimestamp * 1000
                                ).toLocaleString()}
                            />
                        )}

                        <View style={styles.buttonContainer}>
                            <Button
                                title={localeString(
                                    'views.Tools.NostrKeys.backupNow'
                                )}
                                onPress={this.handleBackup}
                                disabled={
                                    loading || CashuStore.mintUrls.length === 0
                                }
                            />
                        </View>

                        <View style={styles.buttonContainer}>
                            <Button
                                title={localeString(
                                    'views.Tools.NostrKeys.restoreMints'
                                )}
                                onPress={this.handleRestore}
                                disabled={loading}
                                secondary
                            />
                        </View>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    description: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14,
        marginBottom: 20,
        lineHeight: 20
    },
    buttonContainer: {
        marginTop: 15
    }
});
