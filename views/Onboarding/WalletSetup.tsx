import * as React from 'react';
import { ImageBackground, View, StyleSheet } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Text from '../../components/Text';

import SettingsStore from '../../stores/SettingsStore';

import { font } from '../../utils/FontUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface WalletSetupProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

@inject('SettingsStore')
@observer
export default class WalletSetup extends React.Component<WalletSetupProps, {}> {
    render() {
        const { navigation } = this.props;

        return (
            <Screen>
                <ImageBackground
                    source={require('../../assets/images/onboarding/temple.jpeg')}
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
                                        'views.WalletSetup.howToUseZeus'
                                    )}
                                </Text>
                            </View>

                            <View style={styles.buttonsContainer}>
                                <View style={styles.buttonWrapper}>
                                    <Button
                                        title={localeString(
                                            'views.WalletSetup.createNewWallet'
                                        )}
                                        onPress={() =>
                                            navigation.navigate('WalletType')
                                        }
                                    />
                                </View>
                                <View style={styles.buttonWrapper}>
                                    <Button
                                        title={localeString(
                                            'views.WalletSetup.connectRemoteNode'
                                        )}
                                        onPress={() =>
                                            navigation.navigate(
                                                'WalletConfiguration',
                                                { newEntry: true }
                                            )
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
