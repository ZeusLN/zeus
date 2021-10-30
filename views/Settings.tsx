import * as React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Avatar, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import PrivacyUtils from './../utils/PrivacyUtils';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';
import ForwardIcon from '../images/SVG/Caret Right-3.svg';
import AccountIcon from '../images/SVG/Wallet2.svg';
import ContactIcon from '../images/SVG/PeersContact.svg';
import PrivacyIcon from '../images/SVG/Eye On.svg';
import SecurityIcon from '../images/SVG/Lock.svg';
import SignIcon from '../images/SVG/Pen.svg';
import BitcoinIcon from '../images/SVG/Bitcoin.svg';
import LanguageIcon from '../images/SVG/Globe.svg';
import HelpIcon from '../images/SVG/Help Icon.svg';
import Identicon from 'identicon.js';
const hash = require('object-hash');

// import SettingsStore, {
//     DEFAULT_THEME,
//     DEFAULT_FIAT,
//     DEFAULT_LOCALE
// } from './../stores/SettingsStore';
import SettingsStore from './../stores/SettingsStore';
import UnitsStore from './../stores/UnitsStore';

interface SettingsProps {
    navigation: any;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
}

@inject('SettingsStore', 'UnitsStore')
@observer
export default class Settings extends React.Component<SettingsProps, {}> {
    componentDidMount() {
        this.refreshSettings();
    }

    UNSAFE_componentWillReceiveProps = () => {
        this.refreshSettings();
    };

    async refreshSettings() {
        await this.props.SettingsStore.getSettings();
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const selectedNode: any =
            (settings &&
                settings.nodes &&
                settings.nodes[settings.selectedNode || 0]) ||
            null;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet', { refresh: true })}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        // const lurkerLabel = `Lurking ${PrivacyUtils.getLover()} Mode: hides sensitive values`;

        const displayName =
            selectedNode.implementation === 'lndhub'
                ? selectedNode.lndhubUrl
                      .replace('https://', '')
                      .replace('http://', '')
                : selectedNode.url
                ? selectedNode.url
                      .replace('https://', '')
                      .replace('http://', '')
                : selectedNode.port
                ? `${selectedNode.host}:${selectedNode.port}`
                : selectedNode.host || 'Unknown';

        const title = PrivacyUtils.sensitiveValue(displayName, 8);
        // const implementation = PrivacyUtils.sensitiveValue(
        //     selectedNode.implementation || 'lnd',
        //     8
        // );

        const data = new Identicon(
            hash.sha1(
                selectedNode.implementation === 'lndhub'
                    ? `${title}-${selectedNode.username}`
                    : title
            ),
            255
        ).toString();

        const Node = (balanceImage: string) => (
            <Avatar
                source={{
                    uri: balanceImage
                }}
                rounded
                size="medium"
            />
        );

        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Settings.title'),
                        style: { color: themeColor('text') }
                    }}
                    backgroundColor={themeColor('secondary')}
                />
                {
                    // {passphraseError && (
                    //     <Text
                    //         style={{
                    //             color: 'red',
                    //             textAlign: 'center',
                    //             padding: 20
                    //         }}
                    //     >
                    //         Passphrases do not match
                    //     </Text>
                }
                <TouchableOpacity onPress={() => navigation.navigate('Nodes')}>
                    <View
                        style={{
                            backgroundColor: '#31363F',
                            width: '90%',
                            height: 70,
                            borderRadius: 10,
                            alignSelf: 'center',
                            top: 40
                        }}
                    >
                        <View
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                margin: 12,
                                marginLeft: 28
                            }}
                        >
                            <View style={{ padding: 0 }}>
                                {Node(`data:image/png;base64,${data}`)}
                            </View>
                            <Text
                                style={{
                                    fontSize: 20,
                                    color: '#FFFFFF',
                                    paddingLeft: 30
                                }}
                            >
                                {displayName}
                            </Text>
                            <View
                                style={{
                                    flex: 1,
                                    alignItems: 'flex-end',
                                    marginTop: 25
                                }}
                            >
                                <ForwardIcon />
                            </View>
                        </View>
                        <Text
                            style={{
                                fontSize: 16,
                                color: '#FFFFFF',
                                opacity: 0.6,
                                top: -10,
                                paddingLeft: 109
                            }}
                        >
                            Mainnet over Tor
                        </Text>
                    </View>
                </TouchableOpacity>

                <View
                    style={{
                        backgroundColor: '#31363F',
                        width: '90%',
                        height: 90,
                        borderRadius: 10,
                        alignSelf: 'center',
                        top: 60
                    }}
                >
                    <View style={styles.columnField}>
                        <View>
                            <AccountIcon />
                        </View>
                        <Text style={styles.columnText}>Accounts</Text>
                        <View style={styles.ForwardArrow}>
                            <ForwardIcon />
                        </View>
                    </View>

                    <View style={styles.separationLine} />
                    <View style={styles.columnField}>
                        <View>
                            <ContactIcon />
                        </View>
                        <Text style={styles.columnText}>Contacts</Text>
                        <View style={styles.ForwardArrow}>
                            <ForwardIcon />
                        </View>
                    </View>
                </View>
                <View
                    style={{
                        backgroundColor: '#31363F',
                        width: '90%',
                        height: 138,
                        borderRadius: 10,
                        alignSelf: 'center',
                        top: 80
                    }}
                >
                    <View style={styles.columnField}>
                        <View>
                            <PrivacyIcon />
                        </View>
                        <Text style={styles.columnText}>Privacy</Text>
                        <View style={styles.ForwardArrow}>
                            <ForwardIcon />
                        </View>
                    </View>

                    <View style={styles.separationLine} />
                    <View style={styles.columnField}>
                        <View>
                            <SecurityIcon />
                        </View>
                        <Text style={styles.columnText}>Security</Text>
                        <View style={styles.ForwardArrow}>
                            <ForwardIcon />
                        </View>
                    </View>

                    <View style={styles.separationLine} />
                    <View style={styles.columnField}>
                        <View>
                            <SignIcon />
                        </View>
                        <Text style={styles.columnText}>
                            Sign or verify message
                        </Text>
                        <View style={styles.ForwardArrow}>
                            <ForwardIcon />
                        </View>
                    </View>
                </View>
                <View
                    style={{
                        backgroundColor: '#31363F',
                        width: '90%',
                        height: 90,
                        borderRadius: 10,
                        alignSelf: 'center',
                        top: 100
                    }}
                >
                    <TouchableOpacity
                        style={styles.columnField}
                        onPress={() => navigation.navigate('Currency')}
                    >
                        <View>
                            <BitcoinIcon />
                        </View>
                        <Text style={styles.columnText}>Currency</Text>
                        <View style={styles.ForwardArrow}>
                            <ForwardIcon />
                        </View>
                    </TouchableOpacity>

                    <View style={styles.separationLine} />
                    <TouchableOpacity
                        style={styles.columnField}
                        onPress={() => navigation.navigate('Language')}
                    >
                        <View>
                            <LanguageIcon />
                        </View>
                        <Text style={styles.columnText}>Language</Text>
                        <View style={styles.ForwardArrow}>
                            <ForwardIcon />
                        </View>
                    </TouchableOpacity>
                </View>
                <View
                    style={{
                        backgroundColor: '#31363F',
                        width: '90%',
                        height: 45,
                        borderRadius: 10,
                        alignSelf: 'center',
                        top: 120
                    }}
                >
                    <View style={{ ...styles.columnField }}>
                        <View style={{ padding: 5 }}>
                            <HelpIcon />
                        </View>
                        <Text style={styles.columnText}>Help</Text>
                        <View style={styles.ForwardArrow}>
                            <ForwardIcon />
                        </View>
                    </View>
                </View>
                <Text
                    style={{
                        fontSize: 16,
                        color: '#A7A9AC',
                        alignSelf: 'center',
                        bottom: 25,
                        position: 'absolute'
                    }}
                >
                    Zeus version 0.5.2
                </Text>

                {/* <DropdownSetting
                    title={localeString('views.Settings.fiatRate')}
                    selectedValue={fiat}
                    onValueChange={(value: string) =>
                        this.setState({ fiat: value })
                    }
                    values={[
                        { key: 'Disabled', value: 'Disabled' },
                        { key: 'USD', value: 'USD' },
                        { key: 'JPY', value: 'JPY' },
                        { key: 'CNY', value: 'CNY' },
                        { key: 'SGD', value: 'SGD' },
                        { key: 'HKD', value: 'HKD' },
                        { key: 'CAD', value: 'CAD' },
                        { key: 'NZD', value: 'NZD' },
                        { key: 'AUD', value: 'AUD' },
                        { key: 'CLP', value: 'CLP' },
                        { key: 'GBP', value: 'GBP' },
                        { key: 'DKK', value: 'DKK' },
                        { key: 'SEK', value: 'SEK' },
                        { key: 'ISK', value: 'ISK' },
                        { key: 'CHF', value: 'CHF' },
                        { key: 'BRL', value: 'BRL' },
                        { key: 'EUR', value: 'EUR' },
                        { key: 'RUB', value: 'RUB' },
                        { key: 'PLN', value: 'PLN' },
                        { key: 'THB', value: 'THB' },
                        { key: 'KRW', value: 'KRW' },
                        { key: 'TWD', value: 'TWD' }
                    ]}
                /> */}

                {/* <DropdownSetting
                    title={localeString('views.Settings.theme')}
                    selectedValue={theme}
                    displayValue={themes[theme]}
                    onValueChange={(value: string) =>
                        this.setState({ theme: value })
                    }
                    values={[
                        { key: 'Dark', value: 'dark' },
                        { key: 'Light', value: 'light' },
                        { key: 'Junkie', value: 'junkie' }
                    ]}
                /> */}

                {/* <DropdownSetting
                    title={lurkerLabel}
                    selectedValue={lurkerMode}
                    displayValue={
                        lurkerMode
                            ? localeString('views.Settings.enabled')
                            : localeString('views.Settings.disabled')
                    }
                    onValueChange={(value: boolean) =>
                        this.setState({ lurkerMode: value })
                    }
                    values={[
                        { key: 'Disabled', value: false },
                        { key: 'Enabled', value: true }
                    ]}
                /> */}

                {/* {showPassphraseForm && (
                    <Text
                        style={{
                            color: themeColor('text'),
                            paddingLeft: 10,
                            paddingTop: 10
                        }}
                    >
                        {localeString('views.Settings.newPassphrase')}
                    </Text>
                )} */}
                {/* {showPassphraseForm && (
                    <TextInput
                        placeholder={'********'}
                        placeholderTextColor="darkgray"
                        value={passphrase}
                        onChangeText={(text: string) =>
                            this.setState({
                                passphrase: text,
                                passphraseError: false
                            })
                        }
                        numberOfLines={1}
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={true}
                        style={{
                            fontSize: 20,
                            color: themeColor('text'),
                            paddingLeft: 10
                        }}
                    />
                )} */}
                {/* {showPassphraseForm && (
                    <Text
                        style={{
                            color: themeColor('text'),
                            paddingLeft: 10
                        }}
                    >
                        {localeString('views.Settings.confirmPassphrase')}
                    </Text>
                )} */}
                {/* {showPassphraseForm && (
                    <TextInput
                        placeholder={'********'}
                        placeholderTextColor="darkgray"
                        value={passphraseConfirm}
                        onChangeText={(text: string) =>
                            this.setState({
                                passphraseConfirm: text,
                                passphraseError: false
                            })
                        }
                        numberOfLines={1}
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={true}
                        style={{
                            fontSize: 20,
                            color: themeColor('text'),
                            paddingLeft: 10
                        }}
                    />
                )} */}
                {/* <View style={styles.button}>
                    <Button
                        title={
                            saved
                                ? localeString('views.Settings.settingsSaved')
                                : localeString('views.Settings.saveSettings')
                        }
                        icon={{
                            name: 'save',
                            size: 25,
                            color: saved ? 'black' : 'white'
                        }}
                        buttonStyle={{
                            backgroundColor: saved ? '#fff' : '#261339',
                            borderRadius: 30,
                            width: 350,
                            alignSelf: 'center'
                        }}
                        titleStyle={{
                            color: saved ? 'black' : 'white'
                        }}
                        onPress={() => this.saveSettings()}
                        style={styles.button}
                    />
                </View> */}
                {/* <View style={styles.button}>
                    <Button
                        title={
                            showPassphraseForm
                                ? localeString(
                                      'views.Settings.hidePassphraseForm'
                                  )
                                : localeString(
                                      'views.Settings.showPassphraseForm'
                                  )
                        }
                        icon={{
                            name: 'perm-identity',
                            size: 25,
                            color: 'white'
                        }}
                        onPress={() =>
                            this.setState({
                                showPassphraseForm: !showPassphraseForm
                            })
                        }
                        style={styles.button}
                        buttonStyle={{
                            backgroundColor: 'darkgray',
                            borderRadius: 30,
                            width: 350,
                            alignSelf: 'center'
                        }}
                        titleStyle={{
                            color: 'white'
                        }}
                    />
                </View> */}
                {/* <View style={styles.button}> */}
                {/* <Button
                        title={localeString('views.Settings.about')}
                        buttonStyle={{
                            backgroundColor: 'black',
                            borderRadius: 30,
                            width: 350,
                            alignSelf: 'center'
                        }}
                        onPress={() => navigation.navigate('About')}
                        style={styles.button}
                    />
                </View> */}

                {/* {false && (
                    <View style={styles.button}>
                        <Button
                            title={localeString('views.ImportAccount.title')}
                            buttonStyle={{
                                backgroundColor: 'green',
                                borderRadius: 30,
                                width: 350,
                                alignSelf: 'center'
                            }}
                            onPress={() => navigation.navigate('ImportAccount')}
                            style={styles.button}
                        />
                    </View>
                )} */}

                {/* {RESTUtils.supportsMessageSigning() && (
                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.Settings.signMessage.button'
                            )}
                            buttonStyle={{
                                backgroundColor: 'green',
                                borderRadius: 30,
                                width: 350,
                                alignSelf: 'center'
                            }}
                            onPress={() => navigation.navigate('SignMessage')}
                            style={styles.button}
                        />
                    </View>
                )} */}

                {/* <View style={styles.button}>
                    <Button
                        title={localeString('views.Settings.intro')}
                        buttonStyle={{
                            backgroundColor: 'orange',
                            borderRadius: 30,
                            width: 350,
                            alignSelf: 'center'
                        }}
                        onPress={() =>
                            navigation.navigate('Onboarding', { reset: true })
                        }
                        style={styles.button}
                    />
                </View> */}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    error: {
        color: 'red'
    },
    columnField: {
        flex: 1,
        flexDirection: 'row',
        margin: 8
    },
    columnText: {
        fontSize: 16,
        color: '#FFFFFF',
        left: '30%',
        position: 'absolute',
        marginLeft: -55,
        padding: 6,
        flex: 1
    },
    separationLine: {
        left: '30%',
        width: 298,
        borderColor: '#A7A9AC',
        opacity: 0.2,
        borderWidth: 0.5,
        marginLeft: -50
    },
    ForwardArrow: {
        flex: 1,
        alignItems: 'flex-end',
        padding: 6
    },
    form: {
        paddingTop: 20,
        paddingLeft: 5,
        paddingRight: 5
    },
    picker: {
        height: 50,
        width: 100
    },
    pickerDark: {
        height: 50,
        width: 100,
        color: 'white'
    },
    button: {
        paddingTop: 10
    },
    lurkerField: {
        paddingTop: 15,
        paddingLeft: 10
    }
});
