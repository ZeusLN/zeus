import * as React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { Button, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { version, playStore } from './../../package.json';
import { localeString } from './../../utils/LocaleUtils';

import SettingsStore from './../../stores/SettingsStore';
import UrlUtils from './../../utils/UrlUtils';
import RESTUtils from './../../utils/RESTUtils';

interface AboutProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

@inject('SettingsStore')
@observer
export default class About extends React.Component<AboutProps, {}> {
    render() {
        const { navigation, SettingsStore } = this.props;
        const { settings } = SettingsStore;
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
                        text: localeString('views.Settings.About.about'),
                        style: { color: '#fff' }
                    }}
                    backgroundColor="black"
                />
                <Text
                    style={
                        savedTheme === 'dark'
                            ? styles.darkThemeTextLarge
                            : styles.lightThemeTextLarge
                    }
                >
                    {localeString('views.Settings.About.version')}:{' '}
                    {playStore ? `v${version}-play` : `v${version}`}
                </Text>
                <Text
                    style={
                        savedTheme === 'dark'
                            ? styles.darkThemeText
                            : styles.lightThemeText
                    }
                >
                    {localeString('views.Settings.About.gpl')}
                </Text>
                <Text
                    style={
                        savedTheme === 'dark'
                            ? styles.darkThemeText
                            : styles.lightThemeText
                    }
                >
                    {localeString('views.Settings.About.thanks')}: the Human
                    Rights Foundation, Matt Odell, Jameson Lopp, fiatjaf, Suheb,
                    shesek, k3tan, __B__T__C__, gabidi, Sifir Apps, Zap, Blue
                    Wallet, Ride the Lightning, Blockstream,{' '}
                    {`${localeString('views.Settings.About.and')} `}
                    Lightning Labs.
                </Text>
                <Text
                    style={
                        savedTheme === 'dark'
                            ? styles.darkThemeText
                            : styles.lightThemeText
                    }
                >
                    {localeString('views.Settings.About.created')}
                </Text>
                <View style={styles.button}>
                    <Button
                        title={localeString('views.Settings.About.website')}
                        onPress={() => UrlUtils.goToUrl('https://zeusln.app')}
                        buttonStyle={{
                            backgroundColor: 'black',
                            borderRadius: 30
                        }}
                    />
                </View>
                <View style={styles.button}>
                    <Button
                        title={localeString('views.Settings.About.github')}
                        onPress={() =>
                            UrlUtils.goToUrl('https://github.com/ZeusLN/zeus')
                        }
                        buttonStyle={{
                            backgroundColor: 'black',
                            borderRadius: 30
                        }}
                    />
                </View>
                {RESTUtils.supportsChannelManagement() && (
                    <View style={styles.button}>
                        <Button
                            title={localeString('views.Settings.About.node')}
                            icon={{
                                name: 'computer',
                                size: 25,
                                color: 'white'
                            }}
                            onPress={() =>
                                navigation.navigate('OpenChannel', {
                                    node_pubkey_string:
                                        '03e1210c8d4b236a53191bb172701d76ec06dfa869a1afffcfd8f4e07d9129d898',
                                    host:
                                        'zg6ziy65wqhiczqfqupx26j5yjot5iuxftqtiyvika3xoydc5hx2mtyd.onion:9735'
                                })
                            }
                            buttonStyle={{
                                backgroundColor: 'grey',
                                borderRadius: 30
                            }}
                        />
                    </View>
                )}
                {!playStore && RESTUtils.supportsKeysend() && (
                    <View style={styles.button}>
                        <Button
                            title={localeString('views.Settings.About.keysend')}
                            icon={{
                                name: 'send',
                                size: 25,
                                color: 'white'
                            }}
                            onPress={() =>
                                navigation.navigate('Send', {
                                    destination:
                                        '03e1210c8d4b236a53191bb172701d76ec06dfa869a1afffcfd8f4e07d9129d898',
                                    transactionType: 'Keysend',
                                    isValid: true
                                })
                            }
                            buttonStyle={{
                                backgroundColor: 'grey',
                                borderRadius: 30
                            }}
                        />
                    </View>
                )}
                <View style={styles.button}>
                    <Button
                        title={localeString('views.Settings.About.twitter1')}
                        onPress={() =>
                            UrlUtils.goToUrl('https://twitter.com/ZeusLN')
                        }
                        buttonStyle={{
                            backgroundColor: 'rgb(29, 161, 242)',
                            borderRadius: 30
                        }}
                    />
                </View>
                <View style={styles.button}>
                    <Button
                        title={localeString('views.Settings.About.twitter2')}
                        onPress={() =>
                            UrlUtils.goToUrl('https://twitter.com/evankaloudis')
                        }
                        buttonStyle={{
                            backgroundColor: 'rgb(29, 161, 242)',
                            borderRadius: 30
                        }}
                    />
                </View>
                <View style={styles.button}>
                    <Button
                        title={localeString('views.Settings.About.telegram')}
                        onPress={() => UrlUtils.goToUrl('https://t.me/ZeusLN')}
                        buttonStyle={{
                            borderRadius: 30
                        }}
                    />
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
        padding: 12
    },
    darkThemeText: {
        fontSize: 15,
        color: 'white',
        padding: 12
    },
    lightThemeTextLarge: {
        fontSize: 20,
        color: 'black',
        padding: 12
    },
    darkThemeTextLarge: {
        fontSize: 20,
        color: 'white',
        padding: 12
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10,
        width: 350,
        alignSelf: 'center'
    }
});
