import * as React from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { CheckBox } from '@rneui/themed';

import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import Text from '../../components/Text';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';
import {
    PurgeScan,
    scanPurgeCandidates,
    verifyPurgePreflight,
    executePurge
} from '../../utils/KeychainPurgeUtils';

import { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface KeychainCleanupProps {
    navigation: NativeStackNavigationProp<any, any>;
}

interface KeychainCleanupState {
    loading: boolean;
    purging: boolean;
    scan: PurgeScan | null;
    allDevicesConfirmed: boolean;
    result: string | null;
}

export default class KeychainCleanup extends React.Component<
    KeychainCleanupProps,
    KeychainCleanupState
> {
    state: KeychainCleanupState = {
        loading: true,
        purging: false,
        scan: null,
        allDevicesConfirmed: false,
        result: null
    };

    async componentDidMount() {
        await this.runScan();
    }

    runScan = async () => {
        this.setState({ loading: true, result: null });
        try {
            const scan = await scanPurgeCandidates();
            this.setState({ scan, loading: false });
        } catch (e) {
            console.error('Keychain cleanup scan failed', e);
            this.setState({ scan: null, loading: false });
        }
    };

    candidateCount = (scan: PurgeScan) =>
        scan.syncServers.length +
        scan.legacyLocalServers.length +
        (scan.hasLegacyEncryptedSettings ? 1 : 0);

    confirmPurge = () => {
        Alert.alert(
            localeString('views.Tools.keychainCleanup.confirmTitle'),
            localeString('views.Tools.keychainCleanup.confirmMessage'),
            [
                {
                    text: localeString('general.cancel'),
                    style: 'cancel'
                },
                {
                    text: localeString(
                        'views.Tools.keychainCleanup.confirmAction'
                    ),
                    style: 'destructive',
                    onPress: () => this.purge()
                }
            ]
        );
    };

    purge = async () => {
        const { scan } = this.state;
        if (!scan) return;

        this.setState({ purging: true, result: null });
        try {
            const preflight = await verifyPurgePreflight(scan);
            if (!preflight.ok) {
                this.setState({
                    purging: false,
                    result: `${localeString(
                        'views.Tools.keychainCleanup.preflightFailed'
                    )} (${preflight.reason})`
                });
                return;
            }

            const { deleted, failures } = await executePurge(scan);
            const summary =
                failures.length > 0
                    ? `${localeString(
                          'views.Tools.keychainCleanup.partialSuccess'
                      )} (${deleted}/${deleted + failures.length})`
                    : `${localeString(
                          'views.Tools.keychainCleanup.successMessage'
                      )} (${deleted})`;
            this.setState({ purging: false, result: summary });
            await this.runScan();
            this.setState({ result: summary });
        } catch (e: any) {
            console.error('Keychain cleanup purge failed', e);
            this.setState({
                purging: false,
                result: `${localeString('general.error')}: ${
                    e?.message || String(e)
                }`
            });
        }
    };

    render() {
        const { navigation } = this.props;
        const { loading, purging, scan, allDevicesConfirmed, result } =
            this.state;

        const candidates = scan ? this.candidateCount(scan) : 0;
        const requiresDeviceConfirm = Platform.OS === 'ios';

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Tools.keychainCleanup.title'),
                        style: { color: themeColor('text') }
                    }}
                    navigation={navigation}
                />
                <ScrollView style={styles.content}>
                    <Text
                        style={{
                            ...styles.paragraph,
                            color: themeColor('text')
                        }}
                    >
                        {localeString('views.Tools.keychainCleanup.explainer1')}
                    </Text>
                    {Platform.OS === 'ios' && (
                        <Text
                            style={{
                                ...styles.paragraph,
                                color: themeColor('warning')
                            }}
                        >
                            {localeString(
                                'views.Tools.keychainCleanup.explainer2'
                            )}
                        </Text>
                    )}
                    <Text
                        style={{
                            ...styles.paragraph,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {localeString('views.Tools.keychainCleanup.explainer3')}
                    </Text>

                    {loading && <LoadingIndicator />}

                    {!loading && scan && candidates === 0 && !result && (
                        <Text
                            style={{
                                ...styles.paragraph,
                                color: themeColor('text')
                            }}
                        >
                            {localeString(
                                'views.Tools.keychainCleanup.nothingFound'
                            )}
                        </Text>
                    )}

                    {!loading && scan && candidates > 0 && (
                        <View style={styles.scanBox}>
                            <Text
                                style={{
                                    ...styles.paragraph,
                                    color: themeColor('text')
                                }}
                            >
                                {`${localeString(
                                    'views.Tools.keychainCleanup.foundEntries'
                                )}: ${candidates}`}
                            </Text>
                            {scan.syncServers.length > 0 && (
                                <Text
                                    style={{
                                        ...styles.detailLine,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {`${localeString(
                                        'views.Tools.keychainCleanup.foundCloud'
                                    )}: ${scan.syncServers.length}`}
                                </Text>
                            )}
                            {scan.legacyLocalServers.length > 0 && (
                                <Text
                                    style={{
                                        ...styles.detailLine,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {`${localeString(
                                        'views.Tools.keychainCleanup.foundLegacy'
                                    )}: ${scan.legacyLocalServers.length}`}
                                </Text>
                            )}
                            {scan.hasLegacyEncryptedSettings && (
                                <Text
                                    style={{
                                        ...styles.detailLine,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Tools.keychainCleanup.foundEncryptedStorage'
                                    )}
                                </Text>
                            )}
                        </View>
                    )}

                    {!loading && scan && candidates > 0 && (
                        <>
                            {requiresDeviceConfirm && (
                                <CheckBox
                                    title={localeString(
                                        'views.Tools.keychainCleanup.allDevicesConfirm'
                                    )}
                                    checked={allDevicesConfirmed}
                                    onPress={() =>
                                        this.setState({
                                            allDevicesConfirmed:
                                                !allDevicesConfirmed
                                        })
                                    }
                                    containerStyle={{
                                        backgroundColor: 'transparent',
                                        borderWidth: 0
                                    }}
                                    textStyle={{
                                        color: themeColor('text')
                                    }}
                                    checkedColor={themeColor('highlight')}
                                />
                            )}
                            <Button
                                title={localeString(
                                    'views.Tools.keychainCleanup.purgeButton'
                                )}
                                onPress={this.confirmPurge}
                                warning
                                disabled={
                                    purging ||
                                    (requiresDeviceConfirm &&
                                        !allDevicesConfirmed)
                                }
                                containerStyle={styles.button}
                            />
                        </>
                    )}

                    {purging && <LoadingIndicator />}

                    {result && (
                        <Text
                            style={{
                                ...styles.paragraph,
                                color: themeColor('text')
                            }}
                        >
                            {result}
                        </Text>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: 20
    },
    paragraph: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 15,
        marginBottom: 14
    },
    detailLine: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14,
        marginBottom: 4
    },
    scanBox: {
        marginBottom: 14
    },
    button: {
        marginVertical: 14
    }
});
