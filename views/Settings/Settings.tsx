import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    Image,
    TouchableOpacity,
    TouchableWithoutFeedback
} from 'react-native';
import { Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import RNFS from 'react-native-fs';

import AddIcon from '../../assets/images/SVG/Add.svg';
import BlockIcon from '../../assets/images/SVG/Block.svg';
import ForwardIcon from '../../assets/images/SVG/Caret Right-3.svg';
import ChannelsIcon from '../../assets/images/SVG/Channels.svg';
import ContactIcon from '../../assets/images/SVG/PeersContact.svg';
import PrivacyIcon from '../../assets/images/SVG/Eye On.svg';
import SecurityIcon from '../../assets/images/SVG/Lock.svg';
import SignIcon from '../../assets/images/SVG/Pen.svg';
import CurrencyIcon from '../../assets/images/SVG/Bitcoin.svg';
import BrushIcon from '../../assets/images/SVG/Brush.svg';
import LanguageIcon from '../../assets/images/SVG/Globe.svg';
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
import SpeedometerIcon from '../../assets/images/SVG/Speedometer.svg';

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

    getPhoto(photo: string | null): string {
        if (typeof photo === 'string' && photo.includes('rnfs://')) {
            const fileName = photo.replace('rnfs://', '');
            return `file://${RNFS.DocumentDirectoryPath}/${fileName}`;
        }
        return photo || '';
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
                settings.nodes?.length &&
                settings.nodes[settings.selectedNode || 0]) ||
            null;

        const implementationDisplayValue = {};
        INTERFACE_KEYS.forEach((item) => {
            implementationDisplayValue[item.value] = item.key;
        });

        const OlympusButton = () => (
            <TouchableOpacity
                onPress={() => UrlUtils.goToUrl('https://olympusln.com')}
                accessibilityLabel={localeString('views.Settings.olympus')}
            >
                <Olympus width="37" height="30" fill={themeColor('text')} />
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

        const youveGotSats = paid?.length > 0;
        const forwardArrowColor = themeColor('secondaryText');

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
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
                    {selectedNode ? (
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Nodes')}
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                    backgroundColor: themeColor('secondary'),
                                    width: '90%',
                                    borderRadius: 10,
                                    alignSelf: 'center',
                                    gap: 12,
                                    marginBottom: 5,
                                    paddingLeft: 12,
                                    paddingVertical: 10,
                                    alignItems: 'center'
                                }}
                            >
                                {selectedNode.photo ? (
                                    <Image
                                        source={{
                                            uri: this.getPhoto(
                                                selectedNode.photo
                                            )
                                        }}
                                        style={styles.photo}
                                    />
                                ) : (
                                    <NodeIdenticon
                                        selectedNode={selectedNode}
                                        width={50}
                                        rounded
                                    />
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={{
                                            fontSize: 20,
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {NodeTitle(selectedNode)}
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 16,
                                            color: themeColor('text'),
                                            opacity: 0.6,
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {nodeSubtitle}
                                    </Text>
                                </View>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() =>
                                    navigation.navigate('NodeConfiguration', {
                                        newEntry: true,
                                        index: 0
                                    })
                                }
                            >
                                <View style={styles.icon}>
                                    <AddIcon
                                        fill={themeColor('highlight')}
                                        width={18}
                                        height={18}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('highlight')
                                    }}
                                >
                                    {localeString('views.Settings.connectNode')}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {BackendUtils.supportsLSPs() && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() =>
                                    navigation.navigate('LSPSettings')
                                }
                            >
                                <View style={styles.icon}>
                                    <CloudIcon
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
                                    {localeString('general.lsp')}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedNode &&
                        BackendUtils.supportsCustomPreimages() &&
                        !NodeInfoStore.testnet && (
                            <View
                                style={{
                                    backgroundColor: themeColor('secondary'),
                                    width: '90%',
                                    borderRadius: 10,
                                    alignSelf: 'center',
                                    marginVertical: 5
                                }}
                            >
                                <TouchableOpacity
                                    style={styles.columnField}
                                    onPress={() =>
                                        navigation.navigate(
                                            'LightningAddress',
                                            { skipStatus: youveGotSats }
                                        )
                                    }
                                >
                                    <View style={styles.icon}>
                                        {youveGotSats ? (
                                            <MailboxFlagUp
                                                height={19.25}
                                                width={22}
                                                fill={themeColor('highlight')}
                                            />
                                        ) : (
                                            <MailboxFlagDown
                                                height={19.25}
                                                width={22}
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
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
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
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Contacts')}
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <ContactIcon
                                            stroke={themeColor('text')}
                                            width={27}
                                            height={27}
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
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
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
                                marginVertical: 5
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
                                                <View style={styles.icon}>
                                                    <KeyIcon
                                                        fill={themeColor(
                                                            'text'
                                                        )}
                                                        width={27}
                                                        height={27}
                                                    />
                                                </View>
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
                                                    <ForwardIcon
                                                        stroke={
                                                            forwardArrowColor
                                                        }
                                                    />
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
                                        <View style={styles.icon}>
                                            <BlockIcon
                                                color={themeColor('text')}
                                                width={27}
                                                height={27}
                                            />
                                        </View>
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
                                            <ForwardIcon
                                                stroke={forwardArrowColor}
                                            />
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
                                        <View style={styles.icon}>
                                            <NodeOn
                                                color={themeColor('text')}
                                            />
                                        </View>
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
                                            <ForwardIcon
                                                stroke={forwardArrowColor}
                                            />
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
                                        <View style={styles.icon}>
                                            <NetworkIcon
                                                fill={themeColor('text')}
                                                width={24}
                                                height={24}
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
                                            <ForwardIcon
                                                stroke={forwardArrowColor}
                                            />
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
                                // borderRadius: 10,
                                alignSelf: 'center'
                            }}
                        >
                            {/* <View style={styles.columnField}>
                                <View style={styles.icon}>
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
                                    <ForwardIcon stroke={forwardIconColor} />
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
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() =>
                                    navigation.navigate('PaymentsSettings')
                                }
                            >
                                <View style={styles.icon}>
                                    <SendIcon
                                        fill={themeColor('text')}
                                        width={27}
                                        height={27}
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
                                    <ForwardIcon stroke={forwardArrowColor} />
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
                                        <View style={styles.icon}>
                                            <ReceiveIcon
                                                fill={themeColor('text')}
                                                width={27}
                                                height={27}
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
                                            <ForwardIcon
                                                stroke={forwardArrowColor}
                                            />
                                        </View>
                                    </TouchableOpacity>
                                    <View style={styles.separationLine} />
                                    <TouchableOpacity
                                        style={styles.columnField}
                                        onPress={() =>
                                            navigation.navigate('BumpFee')
                                        }
                                    >
                                        <View style={styles.icon}>
                                            <SpeedometerIcon
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
                                            {localeString(
                                                'views.BumpFee.title'
                                            )}
                                        </Text>
                                        <View style={styles.ForwardArrow}>
                                            <ForwardIcon
                                                stroke={forwardArrowColor}
                                            />
                                        </View>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    )}

                    {selectedNode && BackendUtils.supportsChannelManagement() && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('ChannelsSettings')
                                }
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <ChannelsIcon
                                            fill={themeColor('text')}
                                            width={27}
                                            height={27}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.Wallet.Wallet.channels'
                                        )}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedNode &&
                        !BackendUtils.isLNDBased() &&
                        implementation !== 'lndhub' && (
                            <View
                                style={{
                                    backgroundColor: themeColor('secondary'),
                                    width: '90%',
                                    borderRadius: 10,
                                    alignSelf: 'center',
                                    marginVertical: 5
                                }}
                            >
                                <TouchableOpacity
                                    style={styles.columnField}
                                    onPress={() =>
                                        navigation.navigate('InvoicesSettings')
                                    }
                                >
                                    <View style={styles.icon}>
                                        <ReceiveIcon
                                            fill={themeColor('text')}
                                            width={27}
                                            height={27}
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
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        )}
                    {selectedNode && BackendUtils.supportsMessageSigning() ? (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => navigation.navigate('Privacy')}
                            >
                                <View style={styles.icon}>
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
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>

                            <View style={styles.separationLine} />

                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => navigation.navigate('Security')}
                            >
                                <View style={styles.icon}>
                                    <SecurityIcon
                                        stroke={themeColor('text')}
                                        width={26}
                                        height={26}
                                    />
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
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>

                            <View style={styles.separationLine} />
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() =>
                                    navigation.navigate('SignVerifyMessage')
                                }
                            >
                                <View style={styles.icon}>
                                    <SignIcon
                                        fill={themeColor('text')}
                                        width={18}
                                        height={18}
                                    />
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
                                    <ForwardIcon stroke={forwardArrowColor} />
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
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => navigation.navigate('Privacy')}
                            >
                                <View style={styles.icon}>
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
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>

                            <View style={styles.separationLine} />

                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => navigation.navigate('Security')}
                            >
                                <View style={styles.icon}>
                                    <SecurityIcon
                                        stroke={themeColor('text')}
                                        width={26}
                                        height={26}
                                    />
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
                                    <ForwardIcon stroke={forwardArrowColor} />
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
                            marginVertical: 5
                        }}
                    >
                        <TouchableOpacity
                            style={styles.columnField}
                            onPress={() => navigation.navigate('Currency')}
                        >
                            <View style={styles.icon}>
                                <CurrencyIcon fill={themeColor('text')} />
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
                                <ForwardIcon stroke={forwardArrowColor} />
                            </View>
                        </TouchableOpacity>

                        <View style={styles.separationLine} />
                        <TouchableOpacity
                            style={styles.columnField}
                            onPress={() => navigation.navigate('Language')}
                        >
                            <View style={styles.icon}>
                                <LanguageIcon fill={themeColor('text')} />
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
                                <ForwardIcon stroke={forwardArrowColor} />
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View
                        style={{
                            backgroundColor: themeColor('secondary'),
                            width: '90%',
                            borderRadius: 10,
                            alignSelf: 'center',
                            marginVertical: 5
                        }}
                    >
                        <TouchableOpacity
                            style={styles.columnField}
                            onPress={() => navigation.navigate('Display')}
                        >
                            <View style={styles.icon}>
                                <BrushIcon
                                    fill={themeColor('text')}
                                    width={28}
                                    height={28}
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
                                <ForwardIcon stroke={forwardArrowColor} />
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
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => navigation.navigate('Nostr')}
                            >
                                <View style={styles.icon}>
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
                                    <ForwardIcon stroke={forwardArrowColor} />
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
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() =>
                                    navigation.navigate('PointOfSaleSettings')
                                }
                            >
                                <View style={styles.icon}>
                                    <POS
                                        stroke={themeColor('text')}
                                        fill={themeColor('secondary')}
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
                                    {localeString('general.pos')}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
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
                            marginVertical: 5
                        }}
                    >
                        <TouchableOpacity
                            style={styles.columnField}
                            onPress={() => navigation.navigate('Support')}
                        >
                            <View style={styles.icon}>
                                <Icon
                                    name="favorite"
                                    color={themeColor('text')}
                                    underlayColor="transparent"
                                    size={23}
                                />
                            </View>
                            <Text
                                style={{
                                    ...styles.columnText,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString(
                                    'views.Settings.Support.titleAlt'
                                )}
                            </Text>
                            <View style={styles.ForwardArrow}>
                                <ForwardIcon stroke={forwardArrowColor} />
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View
                        style={{
                            backgroundColor: themeColor('secondary'),
                            width: '90%',
                            borderRadius: 10,
                            alignSelf: 'center',
                            marginVertical: 5
                        }}
                    >
                        <TouchableOpacity
                            style={styles.columnField}
                            onPress={() => navigation.navigate('Help')}
                        >
                            <View style={styles.icon}>
                                <Icon
                                    name="support"
                                    color={themeColor('text')}
                                    underlayColor="transparent"
                                    size={23}
                                />
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
                                <ForwardIcon stroke={forwardArrowColor} />
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
                                color: themeColor('secondaryText'),
                                alignSelf: 'center',
                                fontFamily: 'PPNeueMontreal-Book',
                                marginTop: 5,
                                marginBottom: 10
                            }}
                        >
                            {`ZEUS v${version}`}
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
        marginVertical: 8,
        alignItems: 'center'
    },
    icon: {
        width: 50,
        alignItems: 'center'
    },
    photo: {
        alignSelf: 'center',
        width: 60,
        height: 60,
        borderRadius: 68
    },
    columnText: {
        fontSize: 16,
        flex: 1,
        fontFamily: 'PPNeueMontreal-Book'
    },
    separationLine: {
        borderColor: '#A7A9AC',
        opacity: 0.2,
        borderWidth: 0.5,
        marginLeft: 50,
        marginRight: 40
    },
    ForwardArrow: {
        alignItems: 'flex-end',
        padding: 6,
        marginRight: 6
    },
    form: {
        paddingTop: 20,
        paddingLeft: 5,
        paddingRight: 5
    },
    picker: {
        width: 100
    },
    pickerDark: {
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
