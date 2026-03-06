import * as React from 'react';
import {
    BackHandler,
    Dimensions,
    ImageBackground,
    NativeEventSubscription,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Globe from '../assets/images/SVG/Globe.svg';
import Wordmark from '../assets/images/SVG/wordmark-black.svg';

import Button from '../components/Button';
import Screen from '../components/Screen';
import { ErrorMessage } from '../components/SuccessErrorMessage';

import SettingsStore, { LOCALE_KEYS } from '../stores/SettingsStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import TresArrows from '../assets/images/SVG/TresArrows.svg';

interface IntroSplashProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface IntroSplashState {
    error: boolean;
}

@inject('SettingsStore')
@observer
export default class IntroSplash extends React.Component<
    IntroSplashProps,
    IntroSplashState
> {
    private backPressSubscription: NativeEventSubscription;
    state = {
        error: false
    };

    componentDidMount() {
        // triggers when loaded from navigation or back action
        this.props.navigation.addListener('focus', () => {
            this.props.SettingsStore.getSettings();
        });

        this.backPressSubscription = BackHandler.addEventListener(
            'hardwareBackPress',
            this.handleBackPress.bind(this)
        );
    }

    handleBackPress = () => {
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
                                    onPress={() => navigation.navigate('Menu')}
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
                                        'views.Intro.getStarted'
                                    )}
                                    onPress={() => {
                                        navigation.navigate('Onboarding1');
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
