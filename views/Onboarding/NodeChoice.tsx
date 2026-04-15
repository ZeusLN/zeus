import * as React from 'react';
import {
    ActivityIndicator,
    ImageBackground,
    View,
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Route } from '@react-navigation/native';
import DeviceInfo from 'react-native-device-info';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Text from '../../components/Text';

import ModalStore from '../../stores/ModalStore';
import { DEFAULT_NEUTRINO_PEERS_MAINNET } from '../../stores/SettingsStore';

import { font } from '../../utils/FontUtils';
import {
    pingPeer,
    NEUTRINO_PING_THRESHOLD_MS
} from '../../utils/LndMobileUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface NodeChoiceProps {
    navigation: NativeStackNavigationProp<any, any>;
    ModalStore: ModalStore;
    route: Route<'NodeChoice', { enableCashu: boolean; returnTo?: string }>;
}

interface NodeChoiceState {
    lowRam: boolean;
    poorConnectivity: boolean;
    checking: boolean;
}

const FOUR_GB = 4 * 1024 * 1024 * 1024;

@inject('ModalStore')
@observer
export default class NodeChoice extends React.Component<
    NodeChoiceProps,
    NodeChoiceState
> {
    private _isMounted = false;

    state: NodeChoiceState = {
        lowRam: false,
        poorConnectivity: false,
        checking: true
    };

    async componentDidMount() {
        this._isMounted = true;
        await Promise.allSettled([
            this.checkRam(),
            this.checkPeerConnectivity()
        ]);
        if (this._isMounted) this.setState({ checking: false });
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    private checkRam = async () => {
        try {
            const totalMemory = await DeviceInfo.getTotalMemory();
            if (totalMemory < FOUR_GB && this._isMounted) {
                this.setState({ lowRam: true });
            }
        } catch (e) {
            console.log('RAM check failed', e);
        }
    };

    private checkPeerConnectivity = async () => {
        try {
            let reachableCount = 0;
            for (const peer of DEFAULT_NEUTRINO_PEERS_MAINNET) {
                try {
                    const result = await pingPeer(peer);
                    if (
                        result.reachable &&
                        result.ms < NEUTRINO_PING_THRESHOLD_MS
                    ) {
                        reachableCount++;
                    }
                } catch {
                    // peer timed out or unreachable
                }
                if (reachableCount >= 2) return;
            }
            if (reachableCount < 2 && this._isMounted) {
                this.setState({ poorConnectivity: true });
            }
        } catch (e) {
            console.log('Peer connectivity check failed', e);
        }
    };

    showLdkNodeInfo = () => {
        const { ModalStore } = this.props;
        ModalStore!.toggleInfoModal({
            text: [
                localeString('views.NodeChoice.ldkNode.info1'),
                localeString('views.NodeChoice.ldkNode.info2'),
                localeString('views.NodeChoice.ldkNode.info3')
            ]
        });
    };

    showEmbeddedLndInfo = () => {
        const { ModalStore } = this.props;
        ModalStore!.toggleInfoModal({
            text: [
                localeString('views.NodeChoice.embeddedLnd.info1'),
                localeString('views.NodeChoice.embeddedLnd.info2'),
                localeString('views.NodeChoice.embeddedLnd.info3')
            ]
        });
    };

    handleSelect = (implementation: 'ldk-node' | 'embedded-lnd') => {
        const { navigation, route } = this.props;
        const enableCashu = route.params?.enableCashu ?? false;
        const returnTo = route.params?.returnTo;

        if (returnTo) {
            navigation.navigate(returnTo, { enableCashu, implementation });
        } else {
            navigation.navigate('RecommendedSettings', {
                enableCashu,
                implementation
            });
        }
    };

    render() {
        const { navigation } = this.props;
        const { lowRam, poorConnectivity, checking } = this.state;
        const showWarning = lowRam || poorConnectivity;

        return (
            <Screen>
                <ImageBackground
                    source={require('../../assets/images/onboarding/eagle.jpeg')}
                    resizeMode="cover"
                    style={styles.backgroundImage}
                >
                    <View style={styles.container}>
                        <Header leftComponent="Back" navigation={navigation} />
                        <View style={styles.contentContainer}>
                            <View style={styles.headerContainer}>
                                <Text
                                    style={{
                                        fontSize: 32,
                                        fontFamily: font('marlideBold'),
                                        color: '#fff',
                                        textAlign: 'center'
                                    }}
                                >
                                    {localeString(
                                        'views.NodeChoice.whatMatters'
                                    )}
                                </Text>
                            </View>

                            <View style={styles.buttonsContainer}>
                                <View style={styles.optionContainer}>
                                    <View style={styles.buttonWithInfo}>
                                        <View style={styles.buttonFlex}>
                                            <Button
                                                title={localeString(
                                                    'views.NodeChoice.speedReliability'
                                                )}
                                                onPress={() =>
                                                    this.handleSelect(
                                                        'ldk-node'
                                                    )
                                                }
                                            />
                                        </View>
                                        <TouchableOpacity
                                            onPress={this.showLdkNodeInfo}
                                            style={styles.infoButton}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 20,
                                                    color: '#fff',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                {'  ?'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.optionContainer}>
                                    <View style={styles.buttonWithInfo}>
                                        <View style={styles.buttonFlex}>
                                            <Button
                                                title={localeString(
                                                    'views.NodeChoice.privacyPower'
                                                )}
                                                onPress={() =>
                                                    this.handleSelect(
                                                        'embedded-lnd'
                                                    )
                                                }
                                                secondary
                                            />
                                        </View>
                                        <TouchableOpacity
                                            onPress={this.showEmbeddedLndInfo}
                                            style={styles.infoButton}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 20,
                                                    color: '#fff',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                {'  ?'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {checking ? (
                                    <View style={styles.warningContainer}>
                                        <View style={styles.checkingRow}>
                                            <ActivityIndicator
                                                size="small"
                                                color="#fff"
                                            />
                                            <Text
                                                style={{
                                                    ...styles.checkingText,
                                                    color: '#fff'
                                                }}
                                            >
                                                {localeString(
                                                    'views.NodeChoice.warning.checking'
                                                )}
                                            </Text>
                                        </View>
                                    </View>
                                ) : showWarning ? (
                                    <View style={styles.warningContainer}>
                                        {lowRam && (
                                            <Text
                                                style={{
                                                    ...styles.warningText,
                                                    color: themeColor('warning')
                                                }}
                                            >
                                                {localeString(
                                                    'views.NodeChoice.warning.lowRam'
                                                )}
                                            </Text>
                                        )}
                                        {poorConnectivity && (
                                            <Text
                                                style={{
                                                    ...styles.warningText,
                                                    color: themeColor('warning')
                                                }}
                                            >
                                                {localeString(
                                                    'views.NodeChoice.warning.poorConnectivity'
                                                )}
                                            </Text>
                                        )}
                                        <Text
                                            style={{
                                                ...styles.suggestionText,
                                                color: themeColor('highlight')
                                            }}
                                        >
                                            {localeString(
                                                'views.NodeChoice.warning.suggestion'
                                            )}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    </View>
                </ImageBackground>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    backgroundImage: {
        flex: 1,
        justifyContent: 'center'
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 40
    },
    headerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20
    },
    buttonsContainer: {
        paddingHorizontal: 10,
        paddingBottom: 20
    },
    optionContainer: {
        padding: 10
    },
    buttonWithInfo: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    buttonFlex: {
        flex: 1
    },
    infoButton: {
        padding: 10,
        marginLeft: 5
    },
    warningContainer: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginHorizontal: 10,
        marginTop: 5
    },
    checkingRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    checkingText: {
        fontSize: 13,
        fontFamily: font('regular'),
        marginLeft: 8
    },
    warningText: {
        fontSize: 13,
        fontFamily: font('regular'),
        marginBottom: 4
    },
    suggestionText: {
        fontSize: 13,
        fontFamily: font('regular'),
        marginTop: 4
    }
});
