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
import { StackNavigationProp } from '@react-navigation/stack';

import AddIcon from '../assets/images/SVG/Add.svg';
import BlockIcon from '../assets/images/SVG/Block.svg';
import Bolt12Icon from '../assets/images/SVG/AtSign.svg';
import CoinsIcon from '../assets/images/SVG/Coins.svg';
import EcashIcon from '../assets/images/SVG/Ecash.svg';
import ForwardIcon from '../assets/images/SVG/Caret Right-3.svg';
import ContactIcon from '../assets/images/SVG/PeersContact.svg';
import GearIcon from '../assets/images/SVG/Gear.svg';
import NodeOn from '../assets/images/SVG/Node On.svg';
import Olympus from '../assets/images/SVG/Olympus.svg';
import KeyIcon from '../assets/images/SVG/Key.svg';
import NetworkIcon from '../assets/images/SVG/Network.svg';
import MailboxFlagUp from '../assets/images/SVG/MailboxFlagUp.svg';
import MailboxFlagDown from '../assets/images/SVG/MailboxFlagDown.svg';
import NostrichIcon from '../assets/images/SVG/Nostrich.svg';
import ReceiveIcon from '../assets/images/SVG/Receive.svg';
import RoutingIcon from '../assets/images/SVG/Routing.svg';
import WrenchIcon from '../assets/images/SVG/Wrench.svg';

import Header from '../components/Header';
import NodeIdenticon, { NodeTitle } from '../components/NodeIdenticon';
import Screen from '../components/Screen';

import BackendUtils from '../utils/BackendUtils';
import { getPhoto } from '../utils/PhotoUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';

import NodeInfoStore from '../stores/NodeInfoStore';
import LightningAddressStore from '../stores/LightningAddressStore';
import CashuLightningAddressStore from '../stores/CashuLightningAddressStore';
import SettingsStore, { INTERFACE_KEYS } from '../stores/SettingsStore';
import UnitsStore from '../stores/UnitsStore';

import { version } from '../package.json';

interface MenuProps {
    navigation: StackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    LightningAddressStore: LightningAddressStore;
    CashuLightningAddressStore: CashuLightningAddressStore;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
}

interface MenuState {
    showHiddenItems: boolean;
    easterEggCount: number;
}

@inject(
    'NodeInfoStore',
    'LightningAddressStore',
    'CashuLightningAddressStore',
    'SettingsStore',
    'UnitsStore'
)
@observer
export default class Menu extends React.Component<MenuProps, MenuState> {
    state = {
        showHiddenItems: false,
        easterEggCount: 0
    };

    UNSAFE_componentWillMount() {
        const { navigation } = this.props;

        // triggers when loaded from navigation or back action
        navigation.addListener('focus', this.handleFocus);
    }

    componentWillUnmount() {
        this.props.navigation.removeListener &&
            this.props.navigation.removeListener('focus', this.handleFocus);
    }

    handleFocus = () => this.props.SettingsStore.getSettings();

    render() {
        const {
            navigation,
            NodeInfoStore,
            LightningAddressStore,
            CashuLightningAddressStore,
            SettingsStore
        } = this.props;
        const { showHiddenItems, easterEggCount } = this.state;
        const { implementation, settings, seedPhrase } = SettingsStore;

        // Define the type for implementationDisplayValue
        interface ImplementationDisplayValue {
            [key: string]: string;
        }

        const selectedNode: any =
            (settings &&
                settings.nodes?.length &&
                settings.nodes[settings.selectedNode || 0]) ||
            null;

        const implementationDisplayValue: ImplementationDisplayValue = {};
        INTERFACE_KEYS.forEach((item) => {
            implementationDisplayValue[item.value] = item.key;
        });

        const OlympusButton = () => (
            <TouchableOpacity
                onPress={() => UrlUtils.goToUrl('https://olympusln.com')}
                accessibilityLabel={localeString('views.Settings.olympus')}
            >
                <Olympus fill={themeColor('text')} />
            </TouchableOpacity>
        );

        let nodeSubtitle = '';

        if (selectedNode) {
            nodeSubtitle +=
                implementationDisplayValue[selectedNode.implementation];

            if (
                selectedNode.embeddedLndNetwork &&
                selectedNode.implementation === 'embedded-lnd'
            ) {
                nodeSubtitle += ` (${selectedNode.embeddedLndNetwork})`;
            }
        }

        const youveGotSats = LightningAddressStore.paid?.length > 0;
        const youveGotSatsCashu = CashuLightningAddressStore.paid?.length > 0;
        const forwardArrowColor = themeColor('secondaryText');

        return (
            <Screen>
                <Header
                    leftComponent="Close"
                    rightComponent={<OlympusButton />}
                    navigation={navigation}
                />
                <ScrollView
                    style={{
                        flex: 1,
                        marginTop: 10
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    {selectedNode ? (
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Wallets')}
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
                                            uri: getPhoto(selectedNode.photo)
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
                                    navigation.navigate('WalletConfiguration', {
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
                                    {localeString(
                                        'views.Settings.createConnectWallet'
                                    )}
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
                            onPress={() => {
                                navigation.navigate('Settings');
                            }}
                        >
                            <View style={styles.icon}>
                                <GearIcon
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
                                {localeString('views.Settings.title')}
                            </Text>
                            <View style={styles.ForwardArrow}>
                                <ForwardIcon stroke={forwardArrowColor} />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {implementation === 'embedded-lnd' && seedPhrase && (
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
                                onPress={() => navigation.navigate('Seed')}
                            >
                                <View style={styles.icon}>
                                    <KeyIcon
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
                                    {localeString('views.Settings.Seed.title')}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>

                            <View style={styles.separationLine} />

                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() =>
                                    navigation.navigate('EmbeddedNodeSettings')
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
                                    <ForwardIcon stroke={forwardArrowColor} />
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
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => navigation.navigate('NodeInfo')}
                            >
                                <View style={styles.icon}>
                                    <NodeOn color={themeColor('text')} />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString('views.NodeInfo.title')}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>

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

                                {selectedNode &&
                                    BackendUtils.supportsCashu() &&
                                    settings?.ecash?.enableCashu &&
                                    !NodeInfoStore.testnet && (
                                        <>
                                            <View
                                                style={styles.separationLine}
                                            />

                                            <TouchableOpacity
                                                style={styles.columnField}
                                                onPress={() =>
                                                    navigation.navigate(
                                                        'CashuLightningAddress',
                                                        {
                                                            skipStatus:
                                                                youveGotSatsCashu
                                                        }
                                                    )
                                                }
                                            >
                                                <View style={styles.icon}>
                                                    {youveGotSatsCashu ? (
                                                        <EcashIcon
                                                            height={19.25}
                                                            width={22}
                                                            fill={themeColor(
                                                                'highlight'
                                                            )}
                                                        />
                                                    ) : (
                                                        <EcashIcon
                                                            height={19.25}
                                                            width={22}
                                                            fill={themeColor(
                                                                'text'
                                                            )}
                                                        />
                                                    )}
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
                                                        'cashu.lightningAddress'
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
                                        </>
                                    )}
                            </View>
                        )}

                    {BackendUtils.supportsAddressesWithDerivationPaths() && (
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
                                    navigation.navigate('OnChainAddresses')
                                }
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <CoinsIcon
                                            fill={themeColor('text')}
                                            height={30}
                                            width={30}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.OnChainAddresses.title'
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

                    {selectedNode && BackendUtils.supportsOffers() && (
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
                                onPress={() =>
                                    navigation.navigate('Bolt12Address')
                                }
                            >
                                <View style={styles.columnField}>
                                    <View>
                                        <Bolt12Icon
                                            fill={themeColor('text')}
                                            width={48}
                                            height={30}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.Bolt12Address'
                                        )}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedNode && BackendUtils.supportsOffers() && (
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
                                onPress={() => navigation.navigate('PayCodes')}
                            >
                                <View style={styles.columnField}>
                                    <View>
                                        <ReceiveIcon
                                            fill={themeColor('text')}
                                            width={48}
                                            height={30}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString('general.paycodes')}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedNode && BackendUtils.supportsRouting() && (
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
                                onPress={() => navigation.navigate('Routing')}
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <RoutingIcon
                                            stroke={themeColor('text')}
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
                                        {localeString('general.routing')}
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
                            onPress={() => {
                                navigation.navigate('Tools');
                            }}
                        >
                            <View style={styles.icon}>
                                <WrenchIcon
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
                                {localeString('views.Tools.title')}
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
                            if (!showHiddenItems) {
                                this.setState({
                                    easterEggCount: easterEggCount + 1,
                                    showHiddenItems: easterEggCount >= 4
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
