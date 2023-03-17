import * as React from 'react';
import { Image, View, SafeAreaView, TouchableOpacity } from 'react-native';
import { Header } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Globe from '../assets/images/SVG/Globe.svg';
import WordLogo from '../assets/images/SVG/Word Logo - no outline.svg';

import Button from '../components/Button';
import Screen from '../components/Screen';

import SettingsStore from '../stores/SettingsStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

const Splash = require('../assets/images/intro/splash.png');

interface IntroSplashProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

@inject('SettingsStore')
@observer
export default class IntroSplash extends React.Component<IntroSplashProps, {}> {
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

        return (
            <Screen>
                <Header
                    rightComponent={<LanguageButton />}
                    backgroundColor="transparent"
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
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
                            title={localeString('views.Intro.getStarted')}
                            onPress={() => navigation.navigate('Settings')}
                        />
                    </View>
                    <View
                        style={{
                            padding: 10,
                            marginBottom: 40
                        }}
                    >
                        <Button
                            title={localeString('views.Splash.scanConfig')}
                            onPress={() =>
                                navigation.navigate('HandleAnythingQRScanner')
                            }
                            secondary
                        />
                    </View>
                </SafeAreaView>
            </Screen>
        );
    }
}
