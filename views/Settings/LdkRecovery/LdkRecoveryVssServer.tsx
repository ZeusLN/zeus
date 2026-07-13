import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Route } from '@react-navigation/native';

import Button from '../../../components/Button';
import DropdownSetting from '../../../components/DropdownSetting';
import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import Text from '../../../components/Text';
import TextInput from '../../../components/TextInput';

import { LDK_VSS_SERVER_KEYS } from '../../../stores/SettingsStore';

import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';
import { DEFAULT_VSS_SERVER } from '../../../utils/LdkNodeUtils';
import UrlUtils from '../../../utils/UrlUtils';

interface LdkRecoveryVssServerProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<
        'LdkRecoveryVssServer',
        {
            network: string;
            nickname?: string;
            photo?: string;
            wordCount: 12 | 24;
        }
    >;
}

interface LdkRecoveryVssServerState {
    selectedValue: string;
    customServer: string;
}

export default class LdkRecoveryVssServer extends React.Component<
    LdkRecoveryVssServerProps,
    LdkRecoveryVssServerState
> {
    state = {
        selectedValue: DEFAULT_VSS_SERVER,
        customServer: ''
    };

    private getEffectiveServer = (): string => {
        const { selectedValue, customServer } = this.state;
        return selectedValue === 'custom' ? customServer.trim() : selectedValue;
    };

    private continueToRecovery = () => {
        const { navigation, route } = this.props;
        const { network, nickname, photo, wordCount } = route.params ?? {};

        navigation.navigate('SeedRecovery', {
            network,
            implementation: 'ldk-node',
            nickname,
            photo,
            wordCount,
            vssServer: this.getEffectiveServer() || undefined
        });
    };

    render() {
        const { navigation } = this.props;
        const { selectedValue, customServer } = this.state;
        const customServerTrimmed = customServer.trim();

        const isCustom = selectedValue === 'custom';

        const showInvalidUrlError =
            isCustom &&
            customServerTrimmed !== '' &&
            !UrlUtils.isValidUrl(customServer);
        const disabled =
            isCustom && (customServerTrimmed === '' || showInvalidUrlError);

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.Settings.EmbeddedNode.VssServer.title'
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
                            ...styles.subtitle,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {localeString(
                            'views.Settings.EmbeddedNode.VssServer.subtitle'
                        )}
                    </Text>

                    <DropdownSetting
                        title={localeString(
                            'views.Settings.EmbeddedNode.VssServer.serverUrl'
                        )}
                        selectedValue={selectedValue}
                        onValueChange={(value: string) => {
                            this.setState({
                                selectedValue: value,
                                customServer:
                                    value === 'custom' ? customServer : ''
                            });
                        }}
                        values={LDK_VSS_SERVER_KEYS}
                    />

                    {isCustom && (
                        <>
                            <TextInput
                                value={customServer}
                                placeholder={DEFAULT_VSS_SERVER}
                                onChangeText={(text: string) =>
                                    this.setState({ customServer: text })
                                }
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            {showInvalidUrlError && (
                                <Text
                                    style={{
                                        ...styles.error,
                                        color: themeColor('error')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.invalidServerUrl'
                                    )}
                                </Text>
                            )}
                        </>
                    )}

                    <View style={styles.button}>
                        <Button
                            title={localeString('general.next')}
                            onPress={this.continueToRecovery}
                            disabled={disabled}
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
        paddingHorizontal: 20,
        paddingTop: 20
    },
    subtitle: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 15,
        marginBottom: 24
    },
    error: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 12,
        marginTop: 4
    },
    button: {
        marginTop: 24
    }
});
