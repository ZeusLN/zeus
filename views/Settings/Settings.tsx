import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    TouchableWithoutFeedback
} from 'react-native';
import { inject, observer } from 'mobx-react';

import BlockIcon from '../../assets/images/SVG/Block.svg';
import ForwardIcon from '../../assets/images/SVG/Caret Right-3.svg';
import ContactIcon from '../../assets/images/SVG/PeersContact.svg';
import PrivacyIcon from '../../assets/images/SVG/Eye On.svg';
import SecurityIcon from '../../assets/images/SVG/Lock.svg';
import SignIcon from '../../assets/images/SVG/Pen.svg';
import CurrencyIcon from '../../assets/images/SVG/Currency.svg';
import BrushIcon from '../../assets/images/SVG/Brush.svg';
import LanguageIcon from '../../assets/images/SVG/Globe.svg';
import HelpIcon from '../../assets/images/SVG/Help Icon.svg';
import NodeOn from '../../assets/images/SVG/Node On.svg';
import Olympus from '../../assets/images/SVG/Olympus.svg';
import POS from '../../assets/images/SVG/POS.svg';
import ReceiveIcon from '../../assets/images/SVG/Receive.svg';
import SendIcon from '../../assets/images/SVG/Send.svg';
import KeyIcon from '../../assets/images/SVG/Key.svg';
import NetworkIcon from '../../assets/images/SVG/Network.svg';
import CloudIcon from '../../assets/images/SVG/Cloud.svg';
import MailboxFlagUp from '../../assets/images/SVG/MailboxFlagUp.svg';
import MailboxFlagDown from '../../assets/images/SVG/MailboxFlagDown.svg';
import NostrichIcon from '../../assets/images/SVG/Nostrich.svg';

import Header from '../../components/Header';
import NodeIdenticon, { NodeTitle } from '../../components/NodeIdenticon';
import Screen from '../../components/Screen';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import NodeInfoStore from '../../stores/NodeInfoStore';
import LightningAddressStore from '../../stores/LightningAddressStore';
import SettingsStore, { INTERFACE_KEYS } from '../../stores/SettingsStore';
import UnitsStore from '../../stores/UnitsStore';

import { version } from '../../package.json';

interface SettingsProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    LightningAddressStore: LightningAddressStore;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
}

interface SettingsState {
    showHiddenSettings: boolean;
    easterEggCount: number;
}

@inject('NodeInfoStore', 'LightningAddressStore', 'SettingsStore', 'UnitsStore')
@observer
export default class Settings extends React.Component<
    SettingsProps,
    SettingsState
> {
    state = {
        showHiddenSettings: false,
        easterEggCount: 0
    };

    UNSAFE_componentWillMount() {
        const { SettingsStore, navigation } = this.props;

        SettingsStore.getSettings();

        // triggers when loaded from navigation or back action
        navigation.addListener('didFocus', () => {
            SettingsStore.getSettings();
        });
    }

    componentWillUnmount() {
        this.props.navigation.removeListener &&
            this.props.navigation.removeListener('didFocus');
    }

    render() {
        const {
            navigation,
            NodeInfoStore,
            LightningAddressStore,
            SettingsStore
        } = this.props;
        const { showHiddenSettings, easterEggCount } = this.state;
        const { implementation, settings, seedPhrase } = SettingsStore;
        const { paid } = LightningAddressStore;

        const selectedNode: any =
            (settings &&
                settings.nodes &&
                settings.nodes[settings.selectedNode || 0]) ||
            null;

        const posEnabled = settings?.pos?.squareEnabled;

        const implementationDisplayValue = {};
        INTERFACE_KEYS.forEach((item) => {
            implementationDisplayValue[item.value] = item.key;
        });

        const OlympusButton = () => (
            <TouchableOpacity
                onPress={() => UrlUtils.goToUrl('https://olympusln.com')}
                accessibilityLabel={localeString('views.Settings.olympus')}
            >
                <View style={{ top: -7 }}>
                    <Olympus width="45" height="45" fill={themeColor('text')} />
                </View>
            </TouchableOpacity>
        );

        let nodeSubtitle = '';

        if (selectedNode) {
            nodeSubtitle +=
                implementationDisplayValue[selectedNode.implementation];

            if (selectedNode.embeddedLndNetwork) {
                nodeSubtitle += ` (${selectedNode.embeddedLndNetwork})`;
            }
        }

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    rightComponent={OlympusButton}
                    navigation={navigation}
                />
                <ScrollView
                    style={{
                        flex: 1
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Nodes')}
                    >
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                height: selectedNode ? 70 : 50,
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginTop: 5,
                                marginBottom: 5
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
                                    {nodeSubtitle}
                                </Text>
                            )}
                        </View>
                    </TouchableOpacity>

                    {BackendUtils.supportsLSPs() && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                height: 45,
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginTop: 5,
                                marginBottom: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() =>
                                    navigation.navigate('LSPSettings')
                                }
                            >
                                <View style={{ paddingLeft: 5, paddingTop: 3 }}>
                                    <CloudIcon fill={themeColor('text')} />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString('general.lsp')}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {BackendUtils.supportsCustomPreimages() &&
                        !NodeInfoStore.testnet && (
                            <View
                                style={{
                                    backgroundColor: themeColor('secondary'),
                                    width: '90%',
                                    height: 45,
                                    borderRadius: 10,
                                    alignSelf: 'center',
                                    marginTop: 5,
                                    marginBottom: 5
                                }}
                            >
                                <TouchableOpacity
                                    style={styles.columnField}
                                    onPress={() =>
                                        navigation.navigate('LightningAddress')
                                    }
                                >
                                    <View
                                        style={{
                                            paddingLeft: 5,
                                            paddingTop: 3
                                        }}
                                    >
                                        {paid && paid.length > 0 ? (
                                            <MailboxFlagUp
                                                fill={themeColor('highlight')}
                                            />
                                        ) : (
                                            <MailboxFlagDown
                                                fill={themeColor('text')}
                                            />
                                        )}
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'general.lightningAddress'
                                        )}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        )}

                    {selectedNode && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginTop: 5,
                                marginBottom: 5
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Contacts')}
                            >
                                <View style={styles.columnField}>
                                    <View>
                                        <ContactIcon
                                            stroke={themeColor('text')}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.Contacts.contacts'
                                        )}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedNode && BackendUtils.supportsNodeInfo() && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginTop: 5,
                                marginBottom: 5
                            }}
                        >
                            {implementation === 'embedded-lnd' && (
                                <>
                                    {seedPhrase && (
                                        <>
                                            <TouchableOpacity
                                                style={styles.columnField}
                                                onPress={() =>
                                                    navigation.navigate('Seed')
                                                }
                                            >
                                                <KeyIcon
                                                    fill={themeColor('text')}
                                                    style={{
                                                        marginLeft: 4,
                                                        marginTop: 2
                                                    }}
                                                    width={130}
                                                />
                                                <Text
                                                    style={{
                                                        ...styles.columnText,
                                                        color: themeColor(
                                                            'text'
                                                        )
                                                    }}
                                                >
                                                    {localeString(
                                                        'views.Settings.Seed.title'
                                                    )}
                                                </Text>
                                                <View
                                                    style={styles.ForwardArrow}
                                                >
                                                    <ForwardIcon />
                                                </View>
                                            </TouchableOpacity>

                                            <View
                                                style={styles.separationLine}
                                            />
                                        </>
                                    )}

                                    <TouchableOpacity
                                        style={styles.columnField}
                                        onPress={() =>
                                            navigation.navigate(
                                                'EmbeddedNodeSettings'
                                            )
                                        }
                                    >
                                        <BlockIcon
                                            color={themeColor('text')}
                                            width={28}
                                            style={{ marginLeft: 2 }}
                                        />
                                        <Text
                                            style={{
                                                ...styles.columnText,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.EmbeddedNode.title'
                                            )}
                                        </Text>
                                        <View style={styles.ForwardArrow}>
                                            <ForwardIcon />
                                        </View>
                                    </TouchableOpacity>

                                    <View style={styles.separationLine} />
                                </>
                            )}

                            {BackendUtils.supportsNodeInfo() && (
                                <>
                                    <TouchableOpacity
                                        style={styles.columnField}
                                        onPress={() =>
                                            navigation.navigate('NodeInfo')
                                        }
                                    >
                                        <NodeOn color={themeColor('text')} />
                                        <Text
                                            style={{
                                                ...styles.columnText,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.NodeInfo.title'
                                            )}
                                        </Text>
                                        <View style={styles.ForwardArrow}>
                                            <ForwardIcon />
                                        </View>
                                    </TouchableOpacity>
                                </>
                            )}

                            {BackendUtils.supportsNetworkInfo() && (
                                <>
                                    <View style={styles.separationLine} />

                                    <TouchableOpacity
                                        style={styles.columnField}
                                        onPress={() =>
                                            navigation.navigate('NetworkInfo')
                                        }
                                    >
                                        <View
                                            style={{
                                                alignContent: 'center',
                                                margin: 3
                                            }}
                                        >
                                            <NetworkIcon
                                                fill={themeColor('text')}
                                                width={25}
                                                height={25}
                                            />
                                        </View>
                                        <Text
                                            style={{
                                                ...styles.columnText,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.NetworkInfo.title'
                                            )}
                                        </Text>
                                        <View style={styles.ForwardArrow}>
                                            <ForwardIcon />
                                        </View>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    )}

                    {/* Coming Soon */}
                    {false && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                height: 45,
                                // borderRadius: 10,
                                alignSelf: 'center'
                            }}
                        >
                            {/* <View style={styles.columnField}>
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
                            </View> */}
                        </View>
                    )}
                    {selectedNode && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginTop: 5,
                                marginBottom: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() =>
                                    navigation.navigate('PaymentsSettings')
                                }
                            >
                                <View>
                                    <SendIcon
                                        fill={themeColor('text')}
                                        style={{ marginLeft: 3, marginTop: 3 }}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString('views.Settings.payments')}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon />
                                </View>
                            </TouchableOpacity>

                            {BackendUtils.isLNDBased() && (
                                <>
                                    <View style={styles.separationLine} />
                                    <TouchableOpacity
                                        style={styles.columnField}
                                        onPress={() =>
                                            navigation.navigate(
                                                'InvoicesSettings'
                                            )
                                        }
                                    >
                                        <View>
                                            <ReceiveIcon
                                                fill={themeColor('text')}
                                                style={{
                                                    marginLeft: 3,
                                                    marginTop: 3
                                                }}
                                            />
                                        </View>
                                        <Text
                                            style={{
                                                ...styles.columnText,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Wallet.Wallet.invoices'
                                            )}
                                        </Text>
                                        <View style={styles.ForwardArrow}>
                                            <ForwardIcon />
                                        </View>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    )}
                    {selectedNode &&
                        !BackendUtils.isLNDBased() &&
                        implementation !== 'lndhub' && (
                            <View
                                style={{
                                    backgroundColor: themeColor('secondary'),
                                    width: '90%',
                                    height: 45,
                                    borderRadius: 10,
                                    alignSelf: 'center',
                                    marginTop: 5,
                                    marginBottom: 5
                                }}
                            >
                                <TouchableOpacity
                                    style={styles.columnField}
                                    onPress={() =>
                                        navigation.navigate('InvoicesSettings')
                                    }
                                >
                                    <View>
                                        <ReceiveIcon
                                            stroke={themeColor('text')}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.Wallet.Wallet.invoices'
                                        )}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        )}
                    {selectedNode && BackendUtils.supportsMessageSigning() ? (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                height: 138,
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginTop: 5,
                                marginBottom: 5
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
                                marginTop: 5,
                                marginBottom: 5
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

                    {posEnabled ? (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginTop: 5,
                                marginBottom: 5
                            }}
                        >
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
                                    {localeString(
                                        'views.Settings.Language.title'
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
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginTop: 5,
                                marginBottom: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => navigation.navigate('Currency')}
                            >
                                <View>
                                    <CurrencyIcon
                                        stroke={themeColor('text')}
                                        style={{ marginLeft: 2 }}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.Currency.title'
                                    )}
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
                                    <LanguageIcon fill={themeColor('text')} />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.Language.title'
                                    )}
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
                            borderRadius: 10,
                            alignSelf: 'center',
                            marginTop: 5,
                            marginBottom: 5
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

                    {false && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginTop: 5,
                                marginBottom: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => navigation.navigate('Nostr')}
                            >
                                <View style={{ paddingLeft: 5, paddingTop: 2 }}>
                                    <NostrichIcon
                                        fill={themeColor('text')}
                                        width={23}
                                        height={23}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    Nostr
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {(showHiddenSettings || posEnabled) && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginTop: 5,
                                marginBottom: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() =>
                                    navigation.navigate('PointOfSaleSettings')
                                }
                            >
                                <View style={{ paddingLeft: 5, paddingTop: 2 }}>
                                    <POS
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
                                    {localeString('general.pos')}
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
                            borderRadius: 10,
                            alignSelf: 'center',
                            marginTop: 5,
                            marginBottom: 5
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
                    <TouchableWithoutFeedback
                        onPress={() => {
                            if (!showHiddenSettings) {
                                this.setState({
                                    easterEggCount: easterEggCount + 1,
                                    showHiddenSettings: easterEggCount >= 4
                                });
                            }
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 16,
                                color: '#A7A9AC',
                                alignSelf: 'center',
                                fontFamily: 'Lato-Regular',
                                marginTop: 5,
                                marginBottom: 20
                            }}
                        >
                            {`Zeus v${version}`}
                        </Text>
                    </TouchableWithoutFeedback>
                </ScrollView>
            </Screen>
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
        left: 100,
        position: 'absolute',
        marginLeft: -55,
        paddingTop: 5,
        flex: 1,
        fontFamily: 'Lato-Regular'
    },
    separationLine: {
        left: 100,
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
