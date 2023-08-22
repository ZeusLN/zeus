import * as React from 'react';
import {
    Image,
    View,
    SafeAreaView,
    Text,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';

import Globe from '../assets/images/SVG/Globe.svg';
import WordLogo from '../assets/images/SVG/Word Logo.svg';

import Button from '../components/Button';
import Header from '../components/Header';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import { ErrorMessage } from '../components/SuccessErrorMessage';

import SettingsStore from '../stores/SettingsStore';

import { createLndWallet } from '../utils/LndMobileUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

const Splash = require('../assets/images/intro/splash.png');

interface IntroSplashProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface IntroSplashState {
    creatingWallet: boolean;
    error: boolean;
}

@inject('SettingsStore')
@observer
export default class IntroSplash extends React.Component<
    IntroSplashProps,
    IntroSplashState
> {
    state = {
        creatingWallet: false,
        error: false
    };

    componentDidMount() {
        // triggers when loaded from navigation or back action
        this.props.navigation.addListener('didFocus', () => {
            this.props.SettingsStore.getSettings();
        });
    }

    render() {
        const { navigation } = this.props;

        const LanguageButton = () => (
            <TouchableOpacity onPress={() => navigation.navigate('Language')}>
                <Globe fill={themeColor('text')} stroke={themeColor('text')} />
            </TouchableOpacity>
        );

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
                        <WordLogo
                            height={100}
                            style={{
                                alignSelf: 'center'
                            }}
                        />
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'Lato-Regular',
                                alignSelf: 'center',
                                fontSize: 15,
                                padding: 8
                            }}
                        >
                            {localeString('views.Intro.creatingWallet')}
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
                <Header rightComponent={LanguageButton} />
                <SafeAreaView
                    style={{
                        flex: 1,
                        paddingTop: 50
                    }}
                >
                    <View
                        style={{
                            flex: 1,
                            flexDirection: 'column',
                            justifyContent: 'center'
                        }}
                    >
                        <Image
                            source={Splash}
                            style={{
                                flex: 1,
                                width: '80%',
                                height: '80%',
                                resizeMode: 'contain',
                                alignSelf: 'center'
                            }}
                        />
                    </View>
                    <WordLogo width="55%" height="20%" alignSelf="center" />
                    <View style={{ height: 40 }}></View>
                    {this.state.error && (
                        <ErrorMessage
                            message={localeString(
                                'views.Intro.errorCreatingWallet'
                            )}
                        />
                    )}
                    <>
                        <View
                            style={{
                                padding: 10
                            }}
                        >
                            <Button
                                title={localeString('views.Intro.whatIsZeus')}
                                onPress={() => navigation.navigate('Intro')}
                                quaternary
                            />
                        </View>
                        <View
                            style={{
                                padding: 10
                            }}
                        >
                            <Button
                                title={localeString('views.Intro.quickStart')}
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

                                    const { wallet, seed, randomBase64 }: any =
                                        response;
                                    if (wallet && wallet.admin_macaroon) {
                                        let nodes = [
                                            {
                                                adminMacaroon:
                                                    wallet.admin_macaroon,
                                                seedPhrase:
                                                    seed.cipher_seed_mnemonic,
                                                walletPassword: randomBase64,
                                                embeddedLndNetwork: 'Mainnet',
                                                implementation: 'embedded-lnd'
                                            }
                                        ];

                                        updateSettings({ nodes }).then(() => {
                                            setConnectingStatus(true);
                                            navigation.navigate('Wallet', {
                                                refresh: true
                                            });
                                        });
                                    } else {
                                        this.setState({
                                            error: true,
                                            creatingWallet: false
                                        });
                                    }
                                }}
                            />
                        </View>
                        <View
                            style={{
                                padding: 10,
                                marginBottom: 40
                            }}
                        >
                            <Button
                                title={localeString(
                                    'views.Intro.advancedSetUp'
                                )}
                                onPress={() => navigation.navigate('Settings')}
                                secondary
                            />
                        </View>
                    </>
                </SafeAreaView>
            </Screen>
        );
    }
}
