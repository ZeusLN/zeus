import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity
} from 'react-native';
import { Avatar, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import PrivacyUtils from './../../utils/PrivacyUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
import ForwardIcon from '../../images/SVG/Caret Right-3.svg';
import AccountIcon from '../../images/SVG/Wallet2.svg';
import ContactIcon from '../../images/SVG/PeersContact.svg';
import PrivacyIcon from '../../images/SVG/Eye On.svg';
import SecurityIcon from '../../images/SVG/Lock.svg';
import SignIcon from '../../images/SVG/Pen.svg';
import BitcoinIcon from '../../images/SVG/Bitcoin.svg';
import LanguageIcon from '../../images/SVG/Globe.svg';
import HelpIcon from '../../images/SVG/Help Icon.svg';
import Identicon from 'identicon.js';
const hash = require('object-hash');
import { version } from './../../package.json';

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
                <ScrollView>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Nodes')}
                    >
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
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
                                        color: themeColor('text'),
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
                                    color: themeColor('text'),
                                    opacity: 0.6,
                                    top: -10,
                                    paddingLeft: 109
                                }}
                            >
                                Mainnet over Tor
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Coming Soon */}
                    {false && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                height: 90,
                                borderRadius: 10,
                                alignSelf: 'center',
                                top: 60
                            }}
                        >
                            <View style={styles.columnField}>
                                <View>
                                    <AccountIcon stroke={themeColor('text')} />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    Accounts
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon />
                                </View>
                            </View>

                            <View style={styles.separationLine} />
                            <View style={styles.columnField}>
                                <View>
                                    <ContactIcon stroke={themeColor('text')} />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    Contacts
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon />
                                </View>
                            </View>
                        </View>
                    )}
                    <View
                        style={{
                            backgroundColor: themeColor('secondary'),
                            width: '90%',
                            height: 138,
                            borderRadius: 10,
                            alignSelf: 'center',
                            top: 60
                        }}
                    >
                        <TouchableOpacity
                            style={styles.columnField}
                            onPress={() => navigation.navigate('Privacy')}
                        >
                            <View>
                                <PrivacyIcon stroke={themeColor('text')} />
                            </View>
                            <Text
                                style={{
                                    ...styles.columnText,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Settings.Privacy.title')}
                            </Text>
                            <View style={styles.ForwardArrow}>
                                <ForwardIcon />
                            </View>
                        </TouchableOpacity>

                        <View style={styles.separationLine} />
                        <View style={styles.columnField}>
                            <View>
                                <SecurityIcon stroke={themeColor('text')} />
                            </View>
                            <Text
                                style={{
                                    ...styles.columnText,
                                    color: themeColor('text')
                                }}
                            >
                                Security
                            </Text>
                            <View style={styles.ForwardArrow}>
                                <ForwardIcon />
                            </View>
                        </View>

                        <View style={styles.separationLine} />
                        <TouchableOpacity
                            style={styles.columnField}
                            onPress={() => navigation.navigate('SignMessage')}
                        >
                            <View>
                                <SignIcon stroke={themeColor('text')} />
                            </View>
                            <Text
                                style={{
                                    ...styles.columnText,
                                    color: themeColor('text')
                                }}
                            >
                                Sign or verify message
                            </Text>
                            <View style={styles.ForwardArrow}>
                                <ForwardIcon />
                            </View>
                        </TouchableOpacity>
                    </View>
                    <View
                        style={{
                            backgroundColor: themeColor('secondary'),
                            width: '90%',
                            height: 90,
                            borderRadius: 10,
                            alignSelf: 'center',
                            top: 80
                        }}
                    >
                        <TouchableOpacity
                            style={styles.columnField}
                            onPress={() => navigation.navigate('Currency')}
                        >
                            <View>
                                <BitcoinIcon stroke={themeColor('text')} />
                            </View>
                            <Text
                                style={{
                                    ...styles.columnText,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Settings.Currency.title')}
                            </Text>
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
                                <LanguageIcon stroke={themeColor('text')} />
                            </View>
                            <Text
                                style={{
                                    ...styles.columnText,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Settings.Language.title')}
                            </Text>
                            <View style={styles.ForwardArrow}>
                                <ForwardIcon />
                            </View>
                        </TouchableOpacity>
                    </View>
                    <View
                        style={{
                            backgroundColor: themeColor('secondary'),
                            width: '90%',
                            height: 45,
                            borderRadius: 10,
                            alignSelf: 'center',
                            top: 100
                        }}
                    >
                        <TouchableOpacity
                            style={styles.columnField}
                            onPress={() => navigation.navigate('Theme')}
                        >
                            <View style={{ padding: 5 }}>
                                <HelpIcon />
                            </View>
                            <Text
                                style={{
                                    ...styles.columnText,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Settings.Theme.title')}
                            </Text>
                            <View style={styles.ForwardArrow}>
                                <ForwardIcon />
                            </View>
                        </TouchableOpacity>
                    </View>
                    <View
                        style={{
                            backgroundColor: themeColor('secondary'),
                            width: '90%',
                            height: 45,
                            borderRadius: 10,
                            alignSelf: 'center',
                            top: 120
                        }}
                    >
                        <TouchableOpacity
                            style={styles.columnField}
                            onPress={() => navigation.navigate('Help')}
                        >
                            <View style={{ padding: 5 }}>
                                <HelpIcon />
                            </View>
                            <Text
                                style={{
                                    ...styles.columnText,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('general.help')}
                            </Text>
                            <View style={styles.ForwardArrow}>
                                <ForwardIcon />
                            </View>
                        </TouchableOpacity>
                    </View>

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
                </ScrollView>
                <Text
                    style={{
                        fontSize: 16,
                        color: '#A7A9AC',
                        alignSelf: 'center',
                        bottom: 25,
                        position: 'absolute'
                    }}
                >
                    {`Zeus v${version}`}
                </Text>
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
