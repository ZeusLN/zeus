import * as React from 'react';
import { Platform, StyleSheet, Text, View, ScrollView } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { localeString } from './../../utils/LocaleUtils';

import SettingsStore from './../../stores/SettingsStore';

interface CertInstallInstructionsProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

@inject('SettingsStore')
@observer
export default class CertInstallInstructions extends React.Component<
    CertInstallInstructionsProps,
    {}
> {
    render() {
        const { navigation, SettingsStore } = this.props;
        const { loading, settings } = SettingsStore;
        const savedTheme = settings.theme;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <ScrollView
                style={
                    savedTheme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString(
                            'views.Settings.CertInstallInstructions.title'
                        ),
                        style: { color: '#fff' }
                    }}
                    backgroundColor={
                        savedTheme === 'dark'
                            ? '#261339'
                            : 'rgba(92, 99,216, 1)'
                    }
                />
                <View style={{ padding: 8 }}>
                    {Platform.OS === 'android' && (
                        <Text
                            style={
                                savedTheme === 'dark'
                                    ? styles.darkThemeText
                                    : styles.lightThemeText
                            }
                        >
                            {localeString(
                                'views.Settings.CertInstallInstructions.graph1'
                            )}
                        </Text>
                    )}
                    {Platform.OS === 'ios' && (
                        <View>
                            <Text
                                style={
                                    savedTheme === 'dark'
                                        ? styles.darkThemeText
                                        : styles.lightThemeText
                                }
                            >
                                {localeString(
                                    'views.Settings.CertInstallInstructions.graph2'
                                )}
                            </Text>
                            <Text
                                style={
                                    savedTheme === 'dark'
                                        ? styles.darkThemeText
                                        : styles.lightThemeText
                                }
                            >
                                {localeString(
                                    'views.Settings.CertInstallInstructions.graph3'
                                )}
                            </Text>
                            <Text
                                style={
                                    savedTheme === 'dark'
                                        ? styles.darkThemeText
                                        : styles.lightThemeText
                                }
                            >
                                {localeString(
                                    'views.Settings.CertInstallInstructions.graph4'
                                )}
                            </Text>
                        </View>
                    )}
                    <Text
                        style={
                            savedTheme === 'dark'
                                ? styles.darkThemeText
                                : styles.lightThemeText
                        }
                    >
                        {localeString(
                            'views.Settings.CertInstallInstructions.graph5'
                        )}
                    </Text>
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1,
        backgroundColor: 'white'
    },
    darkThemeStyle: {
        flex: 1,
        backgroundColor: 'black',
        color: 'white'
    },
    lightThemeText: {
        fontSize: 15,
        color: 'black',
        paddingTop: 12
    },
    darkThemeText: {
        fontSize: 15,
        color: 'white',
        paddingTop: 12
    }
});
