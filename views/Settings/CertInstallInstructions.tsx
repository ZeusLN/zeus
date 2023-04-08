import * as React from 'react';
import { Platform, StyleSheet, Text, View, ScrollView } from 'react-native';

import Header from '../../components/Header';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface CertInstallInstructionsProps {
    navigation: any;
}

export default class CertInstallInstructions extends React.Component<
    CertInstallInstructionsProps,
    {}
> {
    render() {
        const { navigation } = this.props;

        return (
            <Screen>
                <ScrollView
                    style={{
                        flex: 1,
                        backgroundColor: themeColor('background')
                    }}
                >
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.CertInstallInstructions.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        navigation={navigation}
                    />
                    <View style={{ padding: 8 }}>
                        {Platform.OS === 'android' && (
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString(
                                    'views.Settings.CertInstallInstructions.graph1'
                                )}
                            </Text>
                        )}
                        {Platform.OS === 'ios' && (
                            <View>
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.CertInstallInstructions.graph2'
                                    )}
                                </Text>
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.CertInstallInstructions.graph3'
                                    )}
                                </Text>
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.CertInstallInstructions.graph4'
                                    )}
                                </Text>
                            </View>
                        )}
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('text')
                            }}
                        >
                            {localeString(
                                'views.Settings.CertInstallInstructions.graph5'
                            )}
                        </Text>
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontSize: 15,
        paddingTop: 12
    }
});
