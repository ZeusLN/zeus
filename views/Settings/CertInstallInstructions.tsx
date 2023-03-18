import * as React from 'react';
import { Platform, StyleSheet, Text, View, ScrollView } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

interface CertInstallInstructionsProps {
    navigation: any;
}

export default class CertInstallInstructions extends React.Component<
    CertInstallInstructionsProps,
    {}
> {
    render() {
        const { navigation } = this.props;
        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <ScrollView
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background'),
                    color: themeColor('text')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString(
                            'views.Settings.CertInstallInstructions.title'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor="transparent"
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
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
                    <Text style={{ ...styles.text, color: themeColor('text') }}>
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
    text: {
        fontSize: 15,
        paddingTop: 12
    }
});
