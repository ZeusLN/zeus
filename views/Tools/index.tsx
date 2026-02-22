import * as React from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import RNRestart from 'react-native-restart';

import AccountIcon from '../../assets/images/SVG/Account.svg';
import CashuIcon from '../../assets/images/SVG/Ecash.svg';
import CurrencyIcon from '../../assets/images/SVG/Bitcoin.svg';
import ForwardIcon from '../../assets/images/SVG/Caret Right-3.svg';
import SignIcon from '../../assets/images/SVG/Pen.svg';
import SpeedometerIcon from '../../assets/images/SVG/Speedometer.svg';
import SweepIcon from '../../assets/images/SVG/Sweep.svg';
import RebalanceIcon from '../../assets/images/SVG/RebalanceIcon.svg';
import ExportImportIcon from '../../assets/images/SVG/ExportImport.svg';
import WatchtowerIcon from '../../assets/images/SVG/Watchtower.svg';
import NWCIcon from '../../assets/images/SVG/nwc-logo.svg';

import Header from '../../components/Header';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { clearAllData } from '../../utils/DataClearUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { settingsListStyleDefinitions } from '../../utils/settingsListStyleDefinitions';

import SettingsStore from '../../stores/SettingsStore';
import { Icon } from '@rneui/themed';
import { getMenuSearchItem } from '../Menu/searchRegistry';
import {
    buildMenuSearchContext,
    handleMenuSearchItemPress
} from '../Menu/searchUtils';

interface ToolsProps {
    navigation: StackNavigationProp<any, any>;
    route: RouteProp<{ Tools: { showClearDataModal?: boolean } }, 'Tools'>;
    SettingsStore: SettingsStore;
}

interface ToolRowDefinition {
    itemId: string;
    icon: React.ReactNode;
    textColor?: string;
}

@inject('SettingsStore')
@observer
export default class Tools extends React.Component<ToolsProps, {}> {
    focusListener: any = null;

    componentDidMount() {
        const { navigation, route } = this.props;

        this.focusListener = navigation.addListener('focus', this.handleFocus);

        // Auto-show clear data modal if navigated with showClearDataModal param
        if (route.params?.showClearDataModal) {
            this.handleClearStorage();
        }
    }

    componentWillUnmount() {
        if (this.focusListener) {
            this.focusListener();
        }
    }

    handleFocus = () => this.props.SettingsStore.getSettings();

    handleClearStorage = () => {
        Alert.alert(
            localeString('views.Tools.clearStorage.title'),
            localeString('views.Tools.clearStorage.message'),
            [
                {
                    text: localeString('general.cancel'),
                    style: 'cancel'
                },
                {
                    text: localeString('views.Tools.clearStorage.confirm'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await clearAllData();
                            RNRestart.Restart();
                        } catch (error) {
                            console.error('Failed to clear storage:', error);
                            Alert.alert(
                                localeString('general.error'),
                                localeString('views.Tools.clearStorage.error')
                            );
                        }
                    }
                }
            ]
        );
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { settings } = SettingsStore;

        const selectedNode: any =
            (settings &&
                settings.nodes?.length &&
                settings.nodes[settings.selectedNode || 0]) ||
            null;

        const textColor = themeColor('text');
        const warningColor = themeColor('warning');
        const forwardArrowColor = themeColor('secondaryText');

        const searchContext = buildMenuSearchContext({
            hasSelectedNode: !!selectedNode,
            hasEmbeddedSeed: false,
            cashuEnabled: !!settings?.ecash?.enableCashu,
            isTestnet: false,
            supportsOffers: false
        });

        const toolRows: ToolRowDefinition[] = [
            {
                itemId: 'accounts',
                icon: <AccountIcon fill={textColor} />
            },
            {
                itemId: 'nwc',
                icon: <NWCIcon fill={textColor} width={23} height={23} />
            },
            {
                itemId: 'watchtowers',
                icon: <WatchtowerIcon fill={textColor} width={23} height={23} />
            },
            {
                itemId: 'bump-fee',
                icon: (
                    <SpeedometerIcon fill={textColor} width={23} height={23} />
                )
            },
            {
                itemId: 'sign-verify',
                icon: <SignIcon fill={textColor} width={18} height={18} />
            },
            {
                itemId: 'converter',
                icon: <CurrencyIcon fill={textColor} width={18} height={18} />
            },
            {
                itemId: 'rebalance',
                icon: <RebalanceIcon fill={textColor} width={18} height={18} />
            },
            {
                itemId: 'sweep',
                icon: <SweepIcon fill={textColor} width={18} height={18} />
            },
            {
                itemId: 'wif-sweeper',
                icon: (
                    <Icon
                        name="key-plus"
                        type="material-design"
                        color={textColor}
                        size={25}
                    />
                )
            },
            {
                itemId: 'activity-export',
                icon: (
                    <Icon
                        name="upload"
                        type="feather"
                        color={textColor}
                        underlayColor="transparent"
                        size={18}
                    />
                )
            },
            {
                itemId: 'cashu-tools',
                icon: <CashuIcon fill={textColor} width={20} height={20} />
            },
            {
                itemId: 'config-export-import',
                icon: (
                    <ExportImportIcon
                        stroke={textColor}
                        width={18}
                        height={18}
                    />
                )
            },
            {
                itemId: 'withdrawal-request',
                icon: (
                    <Icon
                        name="edit"
                        type="feather"
                        color={textColor}
                        underlayColor="transparent"
                        size={18}
                    />
                )
            },
            {
                itemId: 'developer-tools',
                icon: (
                    <Text
                        style={{
                            color: textColor,
                            fontSize: 14,
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    >
                        {'</>'}
                    </Text>
                )
            },
            {
                itemId: 'clear-storage',
                icon: (
                    <Icon
                        name="trash-2"
                        type="feather"
                        color={warningColor}
                        size={20}
                    />
                ),
                textColor: warningColor
            }
        ];

        const cardStyle = {
            backgroundColor: themeColor('secondary'),
            width: '90%' as const,
            borderRadius: 10,
            alignSelf: 'center' as const,
            marginVertical: 5
        };

        const visibleRows = toolRows.filter((row) => {
            const item = getMenuSearchItem(row.itemId);
            if (!item) {
                return false;
            }

            return item.isVisible(searchContext);
        });

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Tools.title'),
                        style: {
                            color: textColor,
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
                    {visibleRows.map((row) => {
                        const item = getMenuSearchItem(row.itemId);
                        if (!item) {
                            return null;
                        }

                        return (
                            <View key={row.itemId} style={cardStyle}>
                                <TouchableOpacity
                                    style={styles.columnField}
                                    onPress={() =>
                                        handleMenuSearchItemPress({
                                            item,
                                            navigation,
                                            onClearStorage:
                                                row.itemId === 'clear-storage'
                                                    ? this.handleClearStorage
                                                    : undefined
                                        })
                                    }
                                >
                                    <View style={styles.icon}>{row.icon}</View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: row.textColor || textColor
                                        }}
                                    >
                                        {localeString(item.labelKey)}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    ...settingsListStyleDefinitions,
    photo: {
        alignSelf: 'center',
        width: 60,
        height: 60,
        borderRadius: 68
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
