import * as React from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { nip19 } from 'nostr-tools';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import LoadingIndicator from '../../components/LoadingIndicator';
import {
    SuccessMessage,
    ErrorMessage
} from '../../components/SuccessErrorMessage';
import CashuStore from '../../stores/CashuStore';
import SettingsStore from '../../stores/SettingsStore';

import { deriveMintBackupKeypair } from '../../utils/NostrMintBackup';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import HiddenSVG from '../../assets/images/SVG/eye_closed.svg';
import VisibleSVG from '../../assets/images/SVG/eye_opened.svg';

interface NostrKeysProps {
    navigation: NativeStackNavigationProp<any, any>;
    CashuStore: CashuStore;
    SettingsStore: SettingsStore;
}

interface NostrKeysState {
    npub: string;
    nsec: string;
    revealSensitive: boolean;
    loading: boolean;
    backupSuccess: boolean;
    backupError: boolean;
    restoreError: boolean;
}

@inject('CashuStore', 'SettingsStore')
@observer
export default class NostrKeys extends React.Component<
    NostrKeysProps,
    NostrKeysState
> {
    constructor(props: NostrKeysProps) {
        super(props);

        const seed = props.CashuStore.getNostrBackupSeed();
        let npub = '';
        let nsec = '';

        if (seed) {
            const { privateKeyHex, publicKeyHex } =
                deriveMintBackupKeypair(seed);
            npub = nip19.npubEncode(publicKeyHex);
            nsec = nip19.nsecEncode(privateKeyHex);
        }

        this.state = {
            npub,
            nsec,
            revealSensitive: false,
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
        const {
            npub,
            nsec,
            revealSensitive,
            loading,
            backupSuccess,
            backupError,
            restoreError
        } = this.state;
        const { nostrMintBackupTimestamp } = CashuStore;

        const hasSeed = !!npub;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('nostr.keys'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        rightComponent={
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center'
                                }}
                            >
                                {loading && (
                                    <View style={{ marginRight: 10 }}>
                                        <LoadingIndicator size={24} />
                                    </View>
                                )}
                                <TouchableOpacity
                                    onPress={() =>
                                        this.setState({
                                            revealSensitive: !revealSensitive
                                        })
                                    }
                                >
                                    {revealSensitive ? (
                                        <HiddenSVG
                                            fill={themeColor('text')}
                                            width={33.34}
                                            height={30}
                                        />
                                    ) : (
                                        <VisibleSVG
                                            fill={themeColor('text')}
                                            width={33.34}
                                            height={30}
                                        />
                                    )}
                                </TouchableOpacity>
                            </View>
                        }
                        navigation={navigation}
                    />
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ padding: 15 }}
                    >
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

                        <Text
                            style={{
                                ...styles.description,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString('views.Tools.NostrKeys.description')}
                        </Text>

                        {hasSeed ? (
                            <View style={styles.keysContainer}>
                                <KeyValue
                                    keyValue={localeString('nostr.npub')}
                                    value={npub}
                                    sensitive
                                />

                                <KeyValue
                                    keyValue={localeString('nostr.nsec')}
                                    value={
                                        revealSensitive ? nsec : '*'.repeat(63)
                                    }
                                    sensitive
                                />

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
                                            loading ||
                                            CashuStore.mintUrls.length === 0
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
                            </View>
                        ) : (
                            <ErrorMessage
                                message={localeString(
                                    'views.Tools.NostrKeys.noSeed'
                                )}
                            />
                        )}
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
    keysContainer: {
        marginTop: 5
    },
    buttonContainer: {
        marginTop: 15
    }
});
