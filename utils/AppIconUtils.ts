import { ImageSourcePropType, NativeModules, Platform } from 'react-native';

const { AppIcon } = NativeModules;

export type AppIconVariant =
    | 'maxGradient'
    | 'maxFlat'
    | 'maxYellow'
    | 'maxGradientInverse'
    | 'maxRed'
    | 'maxGradientRed'
    | 'maxBlackAndWhite'
    | 'gradient'
    | 'flat'
    | 'yellow'
    | 'gradientInverse'
    | 'red'
    | 'gradientRed'
    | 'blackAndWhite';

interface VariantSpec {
    key: AppIconVariant;
    translateKey: string;
    thumbnail: ImageSourcePropType;
    // iosName: null = iOS primary, string = iOS alternate. All variants
    // ship on iOS.
    iosName: string | null;
    // androidAlias: null = Android primary launcher (no alias toggled),
    // string = Android activity-alias name, undefined = not on Android.
    androidAlias?: string | null;
}

export const APP_ICON_VARIANTS: VariantSpec[] = [
    {
        key: 'maxGradient',
        translateKey: 'views.Settings.AppIcon.maxGradient',
        thumbnail: require('../assets/images/icon_max_gradient.png'),
        iosName: null
    },
    {
        key: 'maxFlat',
        translateKey: 'views.Settings.AppIcon.maxFlat',
        thumbnail: require('../assets/images/icon_max_flat.png'),
        iosName: 'AppIconMaxFlat'
    },
    {
        key: 'maxYellow',
        translateKey: 'views.Settings.AppIcon.maxYellow',
        thumbnail: require('../assets/images/icon_max_yellow.png'),
        iosName: 'AppIconMaxYellow'
    },
    {
        key: 'maxGradientInverse',
        translateKey: 'views.Settings.AppIcon.maxGradientInverse',
        thumbnail: require('../assets/images/icon_max_gradient_inverse.png'),
        iosName: 'AppIconMaxGradientInverse'
    },
    {
        key: 'maxRed',
        translateKey: 'views.Settings.AppIcon.maxRed',
        thumbnail: require('../assets/images/icon_max_red.png'),
        iosName: 'AppIconMaxRed'
    },
    {
        key: 'maxGradientRed',
        translateKey: 'views.Settings.AppIcon.maxGradientRed',
        thumbnail: require('../assets/images/icon_max_gradient_red.png'),
        iosName: 'AppIconMaxGradientRed'
    },
    {
        key: 'maxBlackAndWhite',
        translateKey: 'views.Settings.AppIcon.maxBlackAndWhite',
        thumbnail: require('../assets/images/icon_max_bw.png'),
        iosName: 'AppIconMaxBlackAndWhite'
    },
    {
        key: 'gradient',
        translateKey: 'views.Settings.AppIcon.gradient',
        thumbnail: require('../assets/images/icon_gradient.png'),
        iosName: 'AppIconGradient',
        androidAlias: 'AppIconGradientActivity'
    },
    {
        key: 'flat',
        translateKey: 'views.Settings.AppIcon.flat',
        thumbnail: require('../assets/images/icon_flat.png'),
        iosName: 'AppIconFlat',
        androidAlias: null
    },
    {
        key: 'yellow',
        translateKey: 'views.Settings.AppIcon.yellow',
        thumbnail: require('../assets/images/icon_yellow.png'),
        iosName: 'AppIconYellow',
        androidAlias: 'AppIconYellowActivity'
    },
    {
        key: 'gradientInverse',
        translateKey: 'views.Settings.AppIcon.gradientInverse',
        thumbnail: require('../assets/images/icon_gradient_inverse.png'),
        iosName: 'AppIconGradientInverse',
        androidAlias: 'AppIconGradientInverseActivity'
    },
    {
        key: 'red',
        translateKey: 'views.Settings.AppIcon.red',
        thumbnail: require('../assets/images/icon_red.png'),
        iosName: 'AppIconRed',
        androidAlias: 'AppIconRedActivity'
    },
    {
        key: 'gradientRed',
        translateKey: 'views.Settings.AppIcon.gradientRed',
        thumbnail: require('../assets/images/icon_gradient_red.png'),
        iosName: 'AppIconGradientRed',
        androidAlias: 'AppIconGradientRedActivity'
    },
    {
        key: 'blackAndWhite',
        translateKey: 'views.Settings.AppIcon.blackAndWhite',
        thumbnail: require('../assets/images/icon_bw.png'),
        iosName: 'AppIconBlackAndWhite',
        androidAlias: 'AppIconBlackAndWhiteActivity'
    }
];

export function platformDefaultAppIcon(): AppIconVariant {
    const defaultSpec =
        Platform.OS === 'ios'
            ? APP_ICON_VARIANTS.find((v) => v.iosName === null)
            : APP_ICON_VARIANTS.find((v) => v.androidAlias === null);
    return defaultSpec?.key ?? 'flat';
}

interface SettingsStoreLike {
    getSettings: () => Promise<{ display?: { appIcon?: AppIconVariant } }>;
}

class AppIconUtils {
    isSupported(): boolean {
        return (
            (Platform.OS === 'ios' || Platform.OS === 'android') &&
            AppIcon != null
        );
    }

    availableVariants(): VariantSpec[] {
        if (Platform.OS === 'ios') {
            return APP_ICON_VARIANTS;
        }
        if (Platform.OS === 'android') {
            return APP_ICON_VARIANTS.filter(
                (v) => v.androidAlias !== undefined
            );
        }
        return [];
    }

    async setAppIcon(variant: AppIconVariant): Promise<boolean> {
        if (!this.isSupported()) return false;

        const spec = this.availableVariants().find((v) => v.key === variant);
        if (!spec) {
            console.warn(`Unknown app icon variant: ${variant}`);
            return false;
        }

        try {
            if (Platform.OS === 'ios') {
                await AppIcon.setAlternateIcon(spec.iosName);
            } else if (Platform.OS === 'android') {
                await AppIcon.setVariant(spec.androidAlias ?? 'default');
            }
            return true;
        } catch (error) {
            console.error('Failed to set app icon:', error);
            return false;
        }
    }

    async getAppIcon(): Promise<AppIconVariant> {
        if (!this.isSupported()) return platformDefaultAppIcon();

        try {
            if (Platform.OS === 'ios') {
                const name: string | null = await AppIcon.getAlternateIcon();
                const match = APP_ICON_VARIANTS.find((v) => v.iosName === name);
                return match?.key ?? platformDefaultAppIcon();
            }
            if (Platform.OS === 'android') {
                const alias: string = await AppIcon.getVariant();
                const match = APP_ICON_VARIANTS.find(
                    (v) => v.androidAlias === alias
                );
                return match?.key ?? platformDefaultAppIcon();
            }
        } catch (error) {
            console.error('Failed to get app icon:', error);
        }
        return platformDefaultAppIcon();
    }

    async applyStoredIcon(settingsStore: SettingsStoreLike): Promise<boolean> {
        if (!this.isSupported()) return false;
        try {
            const settings = await settingsStore.getSettings();
            const stored =
                settings?.display?.appIcon ?? platformDefaultAppIcon();
            return await this.setAppIcon(stored);
        } catch (error) {
            console.error('Failed to apply stored app icon:', error);
            return false;
        }
    }
}

export default new AppIconUtils();
