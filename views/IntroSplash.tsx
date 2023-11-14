import * as React from 'react';
import {
    BackHandler,
    Dimensions,
    ImageBackground,
    NativeEventSubscription,
    View,
    SafeAreaView,
    Text
} from 'react-native';
import { inject, observer } from 'mobx-react';

import Globe from '../assets/images/SVG/Globe.svg';
import Wordmark from '../assets/images/SVG/wordmark-black.svg';

import Button from '../components/Button';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import { ErrorMessage } from '../components/SuccessErrorMessage';

import SettingsStore, { LOCALE_KEYS } from '../stores/SettingsStore';

import { createLndWallet } from '../utils/LndMobileUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import TresArrows from '../assets/images/SVG/TresArrows.svg';

interface IntroSplashProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface IntroSplashState {
    creatingWallet: boolean;
    error: boolean;
    modalBlur: number;
}

@inject('SettingsStore')
@observer
export default class IntroSplash extends React.Component<
    IntroSplashProps,
    IntroSplashState
> {
    private backPressSubscription: NativeEventSubscription;
    state = {
        creatingWallet: false,
        error: false,
        modalBlur: 90
    };

    componentDidMount() {
        // triggers when loaded from navigation or back action
        this.props.navigation.addListener('didFocus', () => {
            this.props.SettingsStore.getSettings();
        });

        this.backPressSubscription = BackHandler.addEventListener(
            'hardwareBackPress',
            this.handleBackPress.bind(this)
        );
    }

    handleBackPress = () => {
        if (this.state.creatingWallet) {
            return true;
        }
        BackHandler.exitApp();
        return true;
    };

    componentWillUnmount(): void {
        this.backPressSubscription?.remove();
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const locale = settings.locale || '';

        const localeItem: any = LOCALE_KEYS.filter((item: any) =>
            item.key.includes(locale)
        );
        let localeName;
        if (localeItem[0]) localeName = localeItem[0].value;

        if (this.state.creatingWallet) {
            return (
                <Screen>
                    <View
                        style={{
                            flex: 1,
                            justifyContent: 'center',
                            alignItems: 'center',
                            top: 10
                        }}
                    >
                        <View
                            style={{
                                width: Dimensions.get('window').width * 0.85,
                                maxHeight: 200,
                                marginTop: 10,
                                alignSelf: 'center'
                            }}
                        >
                            <Wordmark fill={themeColor('highlight')} />
                        </View>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book',
                                alignSelf: 'center',
                                fontSize: 15,
                                padding: 8
                            }}
                        >
                            {localeString('views.Intro.creatingWallet').replace(
                                'Zeus',
                                'ZEUS'
                            )}
                        </Text>
                        <View style={{ marginTop: 40 }}>
                            <LoadingIndicator />
                        </View>
                    </View>
                    <View
                        style={{
                            bottom: 56,
                            position: 'absolute',
                            alignSelf: 'center'
                        }}
                    ></View>
                </Screen>
            );
        }

        return (
            <Screen>
                <SafeAreaView
                    style={{
                        flex: 1
                    }}
                >
                    <ImageBackground
                        source={require('../assets/images/hyper.jpg')}
                        resizeMode="cover"
                        style={{
                            flex: 1,
                            justifyContent: 'center'
                        }}
                    >
                        <View style={{ flex: 1, flexDirection: 'column' }}>
                            <View
                                style={{
                                    width:
                                        Dimensions.get('window').width * 0.95,
                                    maxHeight: 200,
                                    marginTop: 10,
                                    alignSelf: 'center'
                                }}
                            >
                                <Wordmark fill={themeColor('background')} />
                            </View>
                            <View style={{ height: 40 }}></View>
                            {this.state.error && (
                                <ErrorMessage
                                    message={localeString(
                                        'views.Intro.errorCreatingWallet'
                                    )}
                                />
                            )}
                        </View>
                        <View style={{ bottom: 0 }}>
                            <View
                                style={{
                                    padding: 10
                                }}
                            >
                                <Button
                                    title={locale ? localeName : 'English'}
                                    icon={
                                        <Globe
                                            fill={themeColor('background')}
                                            stroke={themeColor('background')}
                                            style={{ marginRight: 5 }}
                                        />
                                    }
                                    onPress={() =>
                                        navigation.navigate('Language')
                                    }
                                    tertiary
                                />
                            </View>
                            <View
                                style={{
                                    padding: 10
                                }}
                            >
                                <Button
                                    title={localeString(
                                        'views.Intro.whatIsZeus'
                                    ).replace('Zeus', 'ZEUS')}
                                    onPress={() => navigation.navigate('Intro')}
                                />
                            </View>
                            <View
                                style={{
                                    padding: 10
                                }}
                            >
                                <Button
                                    title={localeString(
                                        'views.Intro.advancedSetUp'
                                    )}
                                    onPress={() =>
                                        navigation.navigate('Settings')
                                    }
                                    secondary
                                />
                            </View>
                            <View
                                style={{
                                    padding: 10,
                                    marginBottom: 10
                                }}
                            >
                                <Button
                                    icon={
                                        <TresArrows
                                            fill={themeColor('background')}
                                        />
                                    }
                                    titleStyle={{
                                        paddingLeft: 10,
                                        color: themeColor('background')
                                    }}
                                    title={localeString(
                                        'views.Intro.quickStart'
                                    )}
                                    onPress={async () => {
                                        this.setState({
                                            creatingWallet: true
                                        });
                                        const { SettingsStore } = this.props;
                                        const {
                                            setConnectingStatus,
                                            updateSettings
                                        } = SettingsStore;

                                        let response;
                                        try {
                                            response = await createLndWallet(
                                                undefined
                                            );
                                        } catch (e) {
                                            this.setState({
                                                error: true,
                                                creatingWallet: false
                                            });
                                        }

                                        const {
                                            wallet,
                                            seed,
                                            randomBase64
                                        }: any = response;
                                        if (wallet && wallet.admin_macaroon) {
                                            let nodes = [
                                                {
                                                    adminMacaroon:
                                                        wallet.admin_macaroon,
                                                    seedPhrase:
                                                        seed.cipher_seed_mnemonic,
                                                    walletPassword:
                                                        randomBase64,
                                                    embeddedLndNetwork:
                                                        'Mainnet',
                                                    implementation:
                                                        'embedded-lnd'
                                                }
                                            ];

                                            updateSettings({ nodes }).then(
                                                () => {
                                                    setConnectingStatus(true);
                                                    navigation.navigate(
                                                        'Wallet',
                                                        {
                                                            refresh: true
                                                        }
                                                    );
                                                }
                                            );
                                        } else {
                                            this.setState({
                                                error: true,
                                                creatingWallet: false
                                            });
                                        }
                                    }}
                                />
                            </View>
                        </View>
                    </ImageBackground>
                </SafeAreaView>
            </Screen>
        );
    }
}
