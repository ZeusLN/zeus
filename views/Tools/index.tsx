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

import AccountIcon from '../../assets/images/SVG/Account.svg';
import CurrencyIcon from '../../assets/images/SVG/Bitcoin.svg';
import ForwardIcon from '../../assets/images/SVG/Caret Right-3.svg';
import SignIcon from '../../assets/images/SVG/Pen.svg';
import SpeedometerIcon from '../../assets/images/SVG/Speedometer.svg';
import SweepIcon from '../../assets/images/SVG/Sweep.svg';

import Header from '../../components/Header';
import Screen from '../../components/Screen';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import SettingsStore from '../../stores/SettingsStore';
import { Icon } from 'react-native-elements';

interface ToolsProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

@inject('SettingsStore')
@observer
export default class Tools extends React.Component<ToolsProps, {}> {
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
        const { navigation, SettingsStore } = this.props;
        const { settings } = SettingsStore;

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
                        text: localeString('views.Tools.title'),
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
                    {BackendUtils.supportsAccounts() && (
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
                                onPress={() => navigation.navigate('Accounts')}
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <AccountIcon
                                            fill={themeColor('text')}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString('views.Accounts.title')}
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
                            {BackendUtils.isLNDBased() && (
                                <>
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

                    {selectedNode && BackendUtils.supportsMessageSigning() && (
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
                            onPress={() =>
                                navigation.navigate('CurrencyConverter')
                            }
                        >
                            <View style={styles.icon}>
                                <CurrencyIcon
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
                                    'views.Settings.CurrencyConverter.title'
                                )}
                            </Text>
                            <View style={styles.ForwardArrow}>
                                <ForwardIcon stroke={forwardArrowColor} />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {BackendUtils.supportsSweep() && (
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
                                onPress={() => navigation.navigate('Sweep')}
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <SweepIcon
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
                                        {localeString('views.Sweep.title')}
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
                                style={styles.columnField}
                                onPress={() =>
                                    navigation.navigate('ActivityExport')
                                }
                            >
                                <View style={styles.icon}>
                                    <Icon
                                        name="download"
                                        type="feather"
                                        color={themeColor('text')}
                                        underlayColor="transparent"
                                        size={18}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString('views.ActivityExport.title')}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {BackendUtils.supportsDevTools() && (
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
                                    navigation.navigate('DeveloperTools')
                                }
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <Text
                                            style={{
                                                color: themeColor('text'),
                                                fontSize: 14,
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            {'</>'}
                                        </Text>
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString('views.Tools.developers')}
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
                    {selectedNode && BackendUtils.supportsPeerManagement() && (
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
                                onPress={() => navigation.navigate('PeersList')}
                            >
                                <View style={styles.icon}>
                                    <Icon
                                        name="account-network"
                                        type="material-community"
                                        size={24}
                                        color={themeColor('text')}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString('views.Settings.peers')}
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
