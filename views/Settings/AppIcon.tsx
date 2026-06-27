import * as React from 'react';
import {
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Text from '../../components/Text';

import SettingsStore from '../../stores/SettingsStore';

import AppIconUtils, {
    AppIconVariant,
    platformDefaultAppIcon
} from '../../utils/AppIconUtils';
import StealthModeUtils from '../../utils/StealthModeUtils';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface AppIconProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface AppIconState {
    selected: AppIconVariant;
    stealthActive: boolean;
}

@inject('SettingsStore')
@observer
export default class AppIcon extends React.Component<
    AppIconProps,
    AppIconState
> {
    state: AppIconState = {
        selected: platformDefaultAppIcon(),
        stealthActive: false
    };

    async componentDidMount() {
        const { SettingsStore } = this.props;
        const settings = await SettingsStore.getSettings();
        const available = AppIconUtils.availableVariants();
        const storedRaw = settings.display && settings.display.appIcon;
        const stored = available.find((v) => v.key === storedRaw)
            ? (storedRaw as AppIconVariant)
            : platformDefaultAppIcon();

        const stealthActive =
            Platform.OS === 'android'
                ? await StealthModeUtils.isStealthModeActive()
                : false;

        this.setState({ selected: stored, stealthActive });
    }

    handleSelect = async (variant: AppIconVariant) => {
        const { SettingsStore } = this.props;
        const { settings, updateSettings } = SettingsStore;
        const previous = this.state.selected;

        if (this.state.stealthActive) return;
        if (variant === previous) return;

        const failAndRevert = async () => {
            // Restore both the native icon and the picker selection.
            await AppIconUtils.setAppIcon(previous);
            this.setState({ selected: previous });
            Alert.alert(
                localeString('general.error'),
                localeString('views.Settings.AppIcon.failure')
            );
        };

        this.setState({ selected: variant });

        const success = await AppIconUtils.setAppIcon(variant);
        if (!success) {
            this.setState({ selected: previous });
            Alert.alert(
                localeString('general.error'),
                localeString('views.Settings.AppIcon.failure')
            );
            return;
        }

        try {
            await updateSettings({
                display: {
                    ...settings.display,
                    appIcon: variant
                }
            });
        } catch (error) {
            console.error('Failed to persist app icon setting:', error);
            await failAndRevert();
        }
    };

    render() {
        const { navigation } = this.props;
        const { selected, stealthActive } = this.state;
        const variants = AppIconUtils.availableVariants();

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.AppIcon.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 40 }}
                >
                    {stealthActive && (
                        <View
                            style={[
                                styles.section,
                                { backgroundColor: themeColor('secondary') }
                            ]}
                        >
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 14,
                                    fontFamily: 'PPNeueMontreal-Book',
                                    textAlign: 'center'
                                }}
                            >
                                {localeString(
                                    'views.Settings.AppIcon.disabledByStealthMode'
                                )}
                            </Text>
                        </View>
                    )}

                    <View
                        style={[
                            styles.section,
                            { backgroundColor: themeColor('secondary') },
                            stealthActive && { opacity: 0.4 }
                        ]}
                    >
                        <View style={styles.grid}>
                            {variants.map((variant) => {
                                const isSelected = selected === variant.key;
                                return (
                                    <TouchableOpacity
                                        key={variant.key}
                                        style={[
                                            styles.cell,
                                            isSelected && {
                                                borderColor:
                                                    themeColor('highlight'),
                                                backgroundColor:
                                                    themeColor('background')
                                            }
                                        ]}
                                        onPress={() =>
                                            this.handleSelect(variant.key)
                                        }
                                        disabled={stealthActive}
                                    >
                                        <Image
                                            source={variant.thumbnail}
                                            style={styles.thumbnail}
                                            resizeMode="contain"
                                        />
                                        <Text
                                            style={{
                                                color: themeColor('text'),
                                                fontSize: 13,
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                marginTop: 8,
                                                textAlign: 'center'
                                            }}
                                        >
                                            {localeString(variant.translateKey)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    section: {
        marginHorizontal: 15,
        marginTop: 15,
        borderRadius: 10,
        padding: 15
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start'
    },
    cell: {
        width: '31%',
        marginHorizontal: '1.16%',
        marginVertical: 6,
        alignItems: 'center',
        padding: 10,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: 'transparent'
    },
    thumbnail: {
        width: 64,
        height: 64,
        borderRadius: Platform.OS === 'android' ? 32 : 14
    }
});
