import * as React from 'react';
import { Image, View, SafeAreaView } from 'react-native';

import Button from './../components/Button';

import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

const Splash = require('./../images/intro/splash.png');

interface IntroSplashProps {
    navigation: any;
}

export default class IntroSplash extends React.Component<IntroSplashProps, {}> {
    render() {
        const { navigation } = this.props;
        return (
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
                    <Image source={Splash} style={{ flex: 1, width: '100%' }} />
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
                        padding: 10
                    }}
                >
                    <Button
                        title={localeString('views.Intro.getStarted')}
                        onPress={() => navigation.navigate('Settings')}
                    />
                </View>
            </SafeAreaView>
        );
    }
}
