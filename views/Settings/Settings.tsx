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
import Identicon from 'identicon.js';

import ForwardIcon from '../../images/SVG/Caret Right-3.svg';
import AccountIcon from '../../images/SVG/Wallet2.svg';
import ContactIcon from '../../images/SVG/PeersContact.svg';
import PrivacyIcon from '../../images/SVG/Eye On.svg';
import SecurityIcon from '../../images/SVG/Lock.svg';
import SignIcon from '../../images/SVG/Pen.svg';
import BitcoinIcon from '../../images/SVG/Bitcoin.svg';
import LanguageIcon from '../../images/SVG/Globe.svg';
import HelpIcon from '../../images/SVG/Help Icon.svg';

import { themeColor } from './../../utils/ThemeUtils';
import { localeString } from './../../utils/LocaleUtils';
import PrivacyUtils from './../../utils/PrivacyUtils';
import RESTUtils from './../../utils/RESTUtils';
import { version } from './../../package.json';
import SettingsStore from './../stores/SettingsStore';
import UnitsStore from './../stores/UnitsStore';
const hash = require('object-hash');

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

        const displayName =
            selectedNode && selectedNode.nickname
                ? selectedNode.nickname
                : selectedNode && selectedNode.implementation === 'lndhub'
                ? selectedNode.lndhubUrl
                      .replace('https://', '')
                      .replace('http://', '')
                : selectedNode && selectedNode.url
                ? selectedNode.url
                      .replace('https://', '')
                      .replace('http://', '')
                : selectedNode && selectedNode.port
                ? `${selectedNode.host}:${selectedNode.port}`
                : (selectedNode && selectedNode.host) || 'Unknown';

        const title = PrivacyUtils.sensitiveValue(displayName, 8);
        const implementation = PrivacyUtils.sensitiveValue(
            selectedNode.implementation || 'lnd',
            8
        );

        const data = new Identicon(
            hash.sha1(
                selectedNode && selectedNode.implementation === 'lndhub'
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
                                {selectedNode && (
                                    <View style={{ padding: 0 }}>
                                        {Node(`data:image/png;base64,${data}`)}
                                    </View>
                                )}
                                <Text
                                    style={{
                                        fontSize: 20,
                                        color: themeColor('text'),
                                        paddingLeft: 30
                                    }}
                                >
                                    {selectedNode
                                        ? displayName
                                        : 'Connect a node'}
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
                            {selectedNode && (
                                <Text
                                    style={{
                                        fontSize: 16,
                                        color: themeColor('text'),
                                        opacity: 0.6,
                                        top: -10,
                                        paddingLeft: 109
                                    }}
                                >
                                    {`${implementation}, ${
                                        selectedNode.enableTor
                                            ? 'Tor'
                                            : 'clearnet'
                                    }`}
                                </Text>
                            )}
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
                    {RESTUtils.supportsMessageSigning() ? (
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
                                    {localeString('views.Settings.privacy')}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon />
                                </View>
                            </TouchableOpacity>

                            <View style={styles.separationLine} />

                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => navigation.navigate('Security')}
                            >
                                <View>
                                    <SecurityIcon stroke={themeColor('text')} />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString('views.Settings.security')}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon />
                                </View>
                            </TouchableOpacity>

                            <View style={styles.separationLine} />
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() =>
                                    navigation.navigate('SignMessage')
                                }
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
                    ) : (
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
                                    {localeString('views.Settings.privacy')}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon />
                                </View>
                            </TouchableOpacity>

                            <View style={styles.separationLine} />

                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => navigation.navigate('Security')}
                            >
                                <View>
                                    <SecurityIcon stroke={themeColor('text')} />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString('views.Settings.security')}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}
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
