import * as React from 'react';
import { Platform, StyleSheet, Text, View, ScrollView } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

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
                        text: 'Certificate Installation Instructions',
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
                            To install a certificate on Android, copy the
                            certificate file to device. Then go to Settings >
                            Security > Install from storage. It should detect
                            the certificate and let you add install it to the
                            device.
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
                                To install a certificate on iOS you must email
                                the file to yourself, once you select the file
                                in your email you will be prompted to install it
                                as a profile.
                            </Text>
                            <Text
                                style={
                                    savedTheme === 'dark'
                                        ? styles.darkThemeText
                                        : styles.lightThemeText
                                }
                            >
                                Alternatively, you can provision a profile with
                                the certificate for your phone in XCode.
                            </Text>
                            <Text
                                style={
                                    savedTheme === 'dark'
                                        ? styles.darkThemeText
                                        : styles.lightThemeText
                                }
                            >
                                You can access the certificate at any time in
                                Settings > General > Profiles and remove it if
                                required.
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
                        If you're connecting to your node via an external
                        hostname or via Tor you must add the hostname to the
                        certificate. lnd provides an option to do this with the
                        TLSExtraDomain option in its config. You'll have to
                        delete and regenerate the certificate after you make the
                        change.
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
