import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Route } from '@react-navigation/native';

import Button from '../../../components/Button';
import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import Text from '../../../components/Text';

import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';

interface LdkWalletRecoverySettingsProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<
        'LdkWalletRecoverySettings',
        {
            network: string;
            nickname?: string;
            photo?: string;
        }
    >;
}

export default class LdkWalletRecoverySettings extends React.Component<
    LdkWalletRecoverySettingsProps,
    {}
> {
    private continueToVssServer = (wordCount: 12 | 24) => {
        const { navigation, route } = this.props;
        const { network, nickname, photo } = route.params ?? {};

        navigation.navigate('LdkRecoveryVssServer', {
            network,
            nickname,
            photo,
            wordCount
        });
    };

    render() {
        const { navigation } = this.props;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.Settings.LdkWalletRecoverySettings.title'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={styles.content}>
                    <Text
                        style={{
                            ...styles.title,
                            color: themeColor('text')
                        }}
                    >
                        {localeString(
                            'views.Settings.LdkWalletRecoverySettings.seedPhraseLength'
                        )}
                    </Text>
                    <Text
                        style={{
                            ...styles.subtitle,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {localeString(
                            'views.Settings.LdkWalletRecoverySettings.seedPhraseLength.subtitle'
                        )}
                    </Text>

                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.Settings.WalletConfiguration.seedPhraseLength.12'
                            )}
                            onPress={() => this.continueToVssServer(12)}
                        />
                    </View>
                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.Settings.WalletConfiguration.seedPhraseLength.24'
                            )}
                            onPress={() => this.continueToVssServer(24)}
                            secondary
                        />
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 20
    },
    title: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 22,
        textAlign: 'center',
        marginBottom: 12
    },
    subtitle: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 40
    },
    button: {
        marginVertical: 8
    }
});
