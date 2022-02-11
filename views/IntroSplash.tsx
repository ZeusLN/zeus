import * as React from 'react';
import { Image, View, SafeAreaView, TouchableOpacity } from 'react-native';
import { Header } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Globe from '../images/SVG/Globe.svg';

import Button from './../components/Button';

import SettingsStore from './../stores/SettingsStore';

import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

const Splash = require('./../images/intro/splash.png');

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
            <>
                <Header
                    rightComponent={<LanguageButton />}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <SafeAreaView
                    style={{
                        flex: 1,
                        backgroundColor: themeColor('background'),
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
                                width: '95%',
                                alignSelf: 'center'
                            }}
                        />
                    </View>
                    <View
                        style={{
                            padding: 10
                        }}
                    >
                        <Button
                            title={localeString('views.Intro.whatIsZeus')}
                            onPress={() => navigation.navigate('Intro')}
                            secondary
                        />
                    </View>
                    <View
                        style={{
                            padding: 10,
                            marginBottom: 40
                        }}
                    >
                        <Button
                            title={localeString('views.Intro.getStarted')}
                            onPress={() => navigation.navigate('Settings')}
                        />
                    </View>
                </SafeAreaView>
            </>
        );
    }
}
