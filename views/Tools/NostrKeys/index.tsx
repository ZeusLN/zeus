import * as React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { nip19 } from 'nostr-tools';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Header from '../../../components/Header';
import KeyValue from '../../../components/KeyValue';
import Screen from '../../../components/Screen';
import Text from '../../../components/Text';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import CashuStore from '../../../stores/CashuStore';

import { deriveMintBackupKeypair } from '../../../utils/NostrMintBackup';
import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import HiddenSVG from '../../../assets/images/SVG/eye_closed.svg';
import VisibleSVG from '../../../assets/images/SVG/eye_opened.svg';
import ForwardIcon from '../../../assets/images/SVG/Caret Right-3.svg';

interface NostrKeysProps {
    navigation: NativeStackNavigationProp<any, any>;
    CashuStore: CashuStore;
}

interface NostrKeysState {
    npub: string;
    nsec: string;
    revealSensitive: boolean;
}

@inject('CashuStore')
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
            revealSensitive: false
        };
    }

    render() {
        const { navigation } = this.props;
        const { npub, nsec, revealSensitive } = this.state;

        const hasSeed = !!npub;
        const forwardArrowColor = themeColor('secondaryText');

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
                        }
                        navigation={navigation}
                    />
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ padding: 15 }}
                    >
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

                                <View style={styles.navItem}>
                                    <TouchableOpacity
                                        style={styles.columnField}
                                        onPress={() =>
                                            navigation.navigate('NostrMintSync')
                                        }
                                    >
                                        <Text
                                            style={{
                                                ...styles.columnText,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Tools.NostrMintSync.title'
                                            )}
                                        </Text>
                                        <View style={styles.ForwardArrow}>
                                            <ForwardIcon
                                                stroke={forwardArrowColor}
                                            />
                                        </View>
                                    </TouchableOpacity>
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
    navItem: {
        marginTop: 20,
        borderRadius: 10
    },
    columnField: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 5,
        borderRadius: 10
    },
    columnText: {
        fontSize: 16,
        flex: 1,
        fontFamily: 'PPNeueMontreal-Book'
    },
    ForwardArrow: {
        alignItems: 'flex-end',
        padding: 6,
        marginRight: 6
    }
});
