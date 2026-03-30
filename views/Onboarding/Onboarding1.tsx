import * as React from 'react';
import { ImageBackground, View, StyleSheet } from 'react-native';
import { observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Text from '../../components/Text';

import { font } from '../../utils/FontUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface Onboarding1Props {
    navigation: NativeStackNavigationProp<any, any>;
}

@observer
export default class Onboarding1 extends React.Component<Onboarding1Props, {}> {
    render() {
        const { navigation } = this.props;

        return (
            <Screen>
                <ImageBackground
                    source={require('../../assets/images/onboarding/zeus.jpeg')}
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
                                        color: themeColor('text'),
                                        textAlign: 'center'
                                    }}
                                >
                                    {localeString(
                                        'views.Onboarding.setupQuestion'
                                    )}
                                </Text>
                            </View>

                            <View style={styles.buttonsContainer}>
                                <View style={styles.buttonWrapper}>
                                    <Button
                                        title={localeString(
                                            'views.Onboarding.recommended'
                                        )}
                                        onPress={() =>
                                            navigation.navigate(
                                                'RecommendedSettings'
                                            )
                                        }
                                    />
                                </View>
                                <View style={styles.buttonWrapper}>
                                    <Button
                                        title={localeString(
                                            'views.Onboarding.questionnaire'
                                        )}
                                        onPress={() =>
                                            navigation.navigate('WalletSetup')
                                        }
                                        secondary
                                    />
                                </View>
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
    buttonWrapper: {
        padding: 10
    }
});
