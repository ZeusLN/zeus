import * as React from 'react';
import { Platform, StyleSheet, Text, View, ScrollView } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

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
        const { navigation } = this.props;
        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <ScrollView style={styles.scrollView}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString(
                            'views.Settings.CertInstallInstructions.title'
                        ),
                        style: { color: '#fff' }
                    }}
                    backgroundColor="#1f2328"
                />
                <View style={{ padding: 8 }}>
                    {Platform.OS === 'android' && (
                        <Text style={styles.text}>
                            {localeString(
                                'views.Settings.CertInstallInstructions.graph1'
                            )}
                        </Text>
                    )}
                    {Platform.OS === 'ios' && (
                        <View>
                            <Text style={styles.text}>
                                {localeString(
                                    'views.Settings.CertInstallInstructions.graph2'
                                )}
                            </Text>
                            <Text style={styles.text}>
                                {localeString(
                                    'views.Settings.CertInstallInstructions.graph3'
                                )}
                            </Text>
                            <Text style={styles.text}>
                                {localeString(
                                    'views.Settings.CertInstallInstructions.graph4'
                                )}
                            </Text>
                        </View>
                    )}
                    <Text style={styles.text}>
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
    scrollView: {
        flex: 1,
        backgroundColor: themeColor('background'),
        color: themeColor('text')
    },
    text: {
        fontSize: 15,
        color: themeColor('text'),
        paddingTop: 12
    }
});
