import * as React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import ForwardIcon from '../../assets/images/SVG/Caret Right-3.svg';
import AccountIcon from '../../assets/images/SVG/Wallet2.svg';
import ContactIcon from '../../assets/images/SVG/PeersContact.svg';
import PrivacyIcon from '../../assets/images/SVG/Eye On.svg';
import SecurityIcon from '../../assets/images/SVG/Lock.svg';
import SignIcon from '../../assets/images/SVG/Pen.svg';
import CurrencyIcon from '../../assets/images/SVG/Currency.svg';
import BrushIcon from '../../assets/images/SVG/Brush.svg';
import LanguageIcon from '../../assets/images/SVG/Globe.svg';
import HelpIcon from '../../assets/images/SVG/Help Icon.svg';
import NodeOn from '../../assets/images/SVG/Node On.svg';

import NodeIdenticon, { NodeTitle } from './../../components/NodeIdenticon';
import { themeColor } from './../../utils/ThemeUtils';
import { localeString } from './../../utils/LocaleUtils';
import RESTUtils from './../../utils/RESTUtils';
import { version } from './../../package.json';
import SettingsStore, { INTERFACE_KEYS } from './../../stores/SettingsStore';
import UnitsStore from './../../stores/UnitsStore';

interface SettingsProps {
    navigation: any;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
}

@inject('SettingsStore', 'UnitsStore')
@observer
export default class Settings extends React.Component<SettingsProps, {}> {
    componentDidMount() {
        // triggers when loaded from navigation or back action
        this.props.navigation.addListener('didFocus', () => {
            this.props.SettingsStore.getSettings();
        });
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

        const implementationDisplayValue = {};
        INTERFACE_KEYS.forEach((item) => {
            implementationDisplayValue[item.value] = item.key;
        });

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
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <TouchableOpacity onPress={() => navigation.navigate('Nodes')}>
                    <View
                        style={{
                            backgroundColor: themeColor('secondary'),
                            width: '90%',
                            height: selectedNode ? 70 : 50,
                            borderRadius: 10,
                            alignSelf: 'center',
                            marginTop: 20
                        }}
                    >
                        <View
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                margin: selectedNode ? 10 : 13,
                                marginLeft: selectedNode ? 14 : 0
                            }}
                        >
                            {selectedNode && (
                                <View style={{ padding: 0 }}>
                                    <NodeIdenticon
                                        selectedNode={selectedNode}
                                        width={50}
                                        rounded
                                    />
                                </View>
                            )}
                            <Text
                                style={{
                                    fontSize: 20,
                                    color: themeColor('text'),
                                    paddingLeft: 20,
                                    fontFamily: 'Lato-Regular'
                                }}
                            >
                                {selectedNode
                                    ? NodeTitle(selectedNode)
                                    : localeString(
                                          'views.Settings.connectNode'
                                      )}
                            </Text>
                            <View
                                style={{
                                    flex: 1,
                                    alignItems: 'flex-end',
                                    marginTop: selectedNode ? 15 : 5
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
                                    paddingLeft: 85,
                                    fontFamily: 'Lato-Regular'
                                }}
                            >
                                {selectedNode.implementation ===
                                'lightning-node-connect'
                                    ? `${
                                          implementationDisplayValue[
                                              selectedNode.implementation
                                          ] || 'Unknown'
                                      }`
                                    : `${
                                          implementationDisplayValue[
                                              selectedNode.implementation
                                          ] || 'Unknown'
                                      }, ${
                                          selectedNode.enableTor
                                              ? 'Tor'
                                              : 'clearnet'
                                      }`}
                            </Text>
                        )}
                    </View>
                </TouchableOpacity>

                {selectedNode && RESTUtils.supportsNodeInfo() && (
                    <View
                        style={{
                            backgroundColor: themeColor('secondary'),
                            width: '90%',
                            height: 45,
                            borderRadius: 10,
                            alignSelf: 'center',
                            top: 15
                        }}
                    >
                        <TouchableOpacity
                            style={styles.columnField}
                            onPress={() => navigation.navigate('NodeInfo')}
                        >
                            <NodeOn color={themeColor('text')} />
                            <Text
                                style={{
                                    ...styles.columnText,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.NodeInfo.title')}
                            </Text>
                            <View style={styles.ForwardArrow}>
                                <ForwardIcon />
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

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
                {selectedNode && RESTUtils.supportsMessageSigning() ? (
                    <View
                        style={{
                            backgroundColor: themeColor('secondary'),
                            width: '90%',
                            height: 138,
                            borderRadius: 10,
                            alignSelf: 'center',
                            top: 30
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
                                navigation.navigate('SignVerifyMessage')
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
                                {localeString(
                                    'views.Settings.SignMessage.title'
                                )}
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
                            top: 30
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
                        top: 50
                    }}
                >
                    <TouchableOpacity
                        style={styles.columnField}
                        onPress={() => navigation.navigate('Currency')}
                    >
                        <View>
                            <CurrencyIcon stroke={themeColor('text')} />
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
                        <View style={{ padding: 4 }}>
                            <LanguageIcon
                                stroke={themeColor('text')}
                                fill={themeColor('secondary')}
                            />
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
                        top: 70
                    }}
                >
                    <TouchableOpacity
                        style={styles.columnField}
                        onPress={() => navigation.navigate('Display')}
                    >
                        <View style={{ paddingLeft: 5, paddingTop: 2 }}>
                            <BrushIcon
                                stroke={themeColor('text')}
                                fill={themeColor('secondary')}
                            />
                        </View>
                        <Text
                            style={{
                                ...styles.columnText,
                                color: themeColor('text')
                            }}
                        >
                            {localeString('views.Settings.Display.title')}
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
                        top: 90
                    }}
                >
                    <TouchableOpacity
                        style={styles.columnField}
                        onPress={() => navigation.navigate('About')}
                    >
                        <View style={{ paddingLeft: 5, paddingTop: 4 }}>
                            <HelpIcon />
                        </View>
                        <Text
                            style={{
                                ...styles.columnText,
                                color: themeColor('text')
                            }}
                        >
                            {localeString('general.about')}
                        </Text>
                        <View style={styles.ForwardArrow}>
                            <ForwardIcon />
                        </View>
                    </TouchableOpacity>
                </View>
                <Text
                    style={{
                        fontSize: 16,
                        color: '#A7A9AC',
                        alignSelf: 'center',
                        bottom: 20,
                        position: 'absolute',
                        fontFamily: 'Lato-Regular'
                    }}
                >
                    {`Zeus v${version}`}
                </Text>
            </View>
        );
    }
}

const styles = StyleSheet.create({
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
        paddingTop: 5,
        flex: 1,
        fontFamily: 'Lato-Regular'
    },
    separationLine: {
        left: '30%',
        width: '70%',
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
