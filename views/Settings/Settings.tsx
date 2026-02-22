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

import EcashIcon from '../../assets/images/SVG/Ecash.svg';
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

import Header from '../../components/Header';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { settingsListStyleDefinitions } from '../../utils/settingsListStyleDefinitions';

import SettingsStore from '../../stores/SettingsStore';
import { getMenuSearchItem } from '../Menu/searchRegistry';
import {
    buildMenuSearchContext,
    handleMenuSearchItemPress
} from '../Menu/searchUtils';

interface SettingsProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface SettingsRowDefinition {
    itemId: string;
    icon: React.ReactNode;
    isVisible?: () => boolean;
}

@inject('SettingsStore')
@observer
export default class Settings extends React.Component<SettingsProps, {}> {
    focusListener: any = null;

    componentDidMount() {
        const { navigation } = this.props;

        this.focusListener = navigation.addListener('focus', this.handleFocus);
    }

    componentWillUnmount() {
        if (this.focusListener) {
            this.focusListener();
        }
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

        const textColor = themeColor('text');
        const forwardArrowColor = themeColor('secondaryText');

        const hasSelectedNode = !!selectedNode;
        const searchContext = buildMenuSearchContext({
            hasSelectedNode,
            hasEmbeddedSeed: false,
            cashuEnabled: !!settings?.ecash?.enableCashu,
            isTestnet: false,
            supportsOffers: false
        });

        const sectionRows: SettingsRowDefinition[][] = [
            [
                {
                    itemId: 'lsp',
                    icon: <CloudIcon fill={textColor} width={25} height={25} />
                }
            ],
            [
                {
                    itemId: 'ecash-settings',
                    icon: <EcashIcon fill={textColor} width={20} height={20} />
                }
            ],
            [
                {
                    itemId: 'payments-settings',
                    icon: <SendIcon fill={textColor} width={27} height={27} />
                },
                {
                    itemId: 'invoices-settings',
                    icon: (
                        <ReceiveIcon fill={textColor} width={27} height={27} />
                    )
                }
            ],
            [
                {
                    itemId: 'channels-settings',
                    icon: (
                        <ChannelsIcon fill={textColor} width={27} height={27} />
                    )
                }
            ],
            [
                {
                    itemId: 'invoices-settings',
                    icon: (
                        <ReceiveIcon fill={textColor} width={27} height={27} />
                    ),
                    isVisible: () =>
                        hasSelectedNode &&
                        !searchContext.isLNDBased &&
                        implementation !== 'lndhub'
                }
            ],
            [
                {
                    itemId: 'privacy',
                    icon: <PrivacyIcon fill={textColor} />
                },
                {
                    itemId: 'security',
                    icon: (
                        <SecurityIcon fill={textColor} width={26} height={26} />
                    )
                }
            ],
            [
                {
                    itemId: 'currency',
                    icon: <CurrencyIcon fill={textColor} />
                },
                {
                    itemId: 'language',
                    icon: <LanguageIcon fill={textColor} />
                }
            ],
            [
                {
                    itemId: 'display',
                    icon: <BrushIcon fill={textColor} width={28} height={28} />
                }
            ],
            [
                {
                    itemId: 'pos-settings',
                    icon: (
                        <POS
                            stroke={textColor}
                            fill={themeColor('secondary')}
                            width={23}
                            height={23}
                        />
                    )
                }
            ]
        ];

        const cardStyle = {
            backgroundColor: themeColor('secondary'),
            width: '90%' as const,
            borderRadius: 10,
            alignSelf: 'center' as const,
            marginVertical: 5
        };

        const renderCard = (rows: SettingsRowDefinition[]) => {
            const visibleRows = rows.filter((row) => {
                const item = getMenuSearchItem(row.itemId);
                if (!item) {
                    return false;
                }

                if (!item.isVisible(searchContext)) {
                    return false;
                }

                if (row.isVisible && !row.isVisible()) {
                    return false;
                }

                return true;
            });

            if (!visibleRows.length) {
                return null;
            }

            return (
                <View
                    key={visibleRows.map((row) => row.itemId).join('-')}
                    style={cardStyle}
                >
                    {visibleRows.map((row, index) => {
                        const item = getMenuSearchItem(row.itemId);
                        if (!item) {
                            return null;
                        }

                        return (
                            <React.Fragment key={`${row.itemId}-${index}`}>
                                <TouchableOpacity
                                    style={styles.columnField}
                                    onPress={() =>
                                        handleMenuSearchItemPress({
                                            item,
                                            navigation
                                        })
                                    }
                                >
                                    <View style={styles.icon}>{row.icon}</View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: textColor
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

                                {index < visibleRows.length - 1 && (
                                    <View style={styles.separationLine} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </View>
            );
        };

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.title'),
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
                    {sectionRows.map((rows) => renderCard(rows))}
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
