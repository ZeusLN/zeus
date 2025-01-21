import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import ForwardIcon from '../../assets/images/SVG/Caret Right-3.svg';
import ChannelsIcon from '../../assets/images/SVG/Channels.svg';
import PrivacyIcon from '../../assets/images/SVG/Eye On.svg';
import SecurityIcon from '../../assets/images/SVG/Lock.svg';
import CurrencyIcon from '../../assets/images/SVG/Bitcoin.svg';
import BrushIcon from '../../assets/images/SVG/Brush.svg';
import LanguageIcon from '../../assets/images/SVG/Globe.svg';
import POS from '../../assets/images/SVG/POS.svg';
import ReceiveIcon from '../../assets/images/SVG/Receive.svg';
import SendIcon from '../../assets/images/SVG/Send.svg';
import CloudIcon from '../../assets/images/SVG/Cloud.svg';
import NostrichIcon from '../../assets/images/SVG/Nostrich.svg';

import Header from '../../components/Header';
import Screen from '../../components/Screen';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import SettingsStore from '../../stores/SettingsStore';

interface SettingsProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

@inject('SettingsStore')
@observer
export default class Settings extends React.Component<SettingsProps, {}> {
    UNSAFE_componentWillMount() {
        const { SettingsStore, navigation } = this.props;

        SettingsStore.getSettings();

        // triggers when loaded from navigation or back action
        navigation.addListener('focus', this.handleFocus);
    }

    componentWillUnmount() {
        this.props.navigation.removeListener &&
            this.props.navigation.removeListener('focus', this.handleFocus);
    }

    handleFocus = () => this.props.SettingsStore.getSettings();

    render() {
        const { navigation, SettingsStore } = this.props;
        const { implementation, settings } = SettingsStore;

        const selectedNode: any =
            (settings &&
                settings.nodes?.length &&
                settings.nodes[settings.selectedNode || 0]) ||
            null;

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
                    navigation={navigation}
                />
                <ScrollView
                    style={{
                        flex: 1,
                        marginTop: 10
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    {BackendUtils.supportsFlowLSP() && selectedNode && (
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
                                    const supportsLSPS1 =
                                        BackendUtils.supportsLSPS1customMessage() ||
                                        BackendUtils.supportsLSPS1rest();
                                    if (
                                        BackendUtils.supportsFlowLSP() &&
                                        supportsLSPS1
                                    ) {
                                        navigation.navigate('LSPServicesList');
                                    } else {
                                        navigation.navigate('LSPSettings');
                                    }
                                }}
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
