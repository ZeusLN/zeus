import * as React from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Icon, ListItem } from '@rneui/themed';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';

import BackendUtils from '../../utils/BackendUtils';
import {
    collectDiagnostics,
    shareDiagnostics,
    DiagnosticsSelections
} from '../../utils/DiagnosticsUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import { settingsStore } from '../../stores/Stores';

interface DiagnosticsProps {
    navigation: NativeStackNavigationProp<any, any>;
}

interface SectionRow {
    key: keyof DiagnosticsSelections;
    label: string;
    description: string;
    available: boolean;
}

export default function Diagnostics(props: DiagnosticsProps) {
    const { navigation } = props;

    const { settings } = settingsStore;
    const activeNode = settings?.nodes?.[settings?.selectedNode || 0];
    const implementation = activeNode?.implementation;

    const lndAvailable = implementation === 'embedded-lnd';
    const ldkAvailable = implementation === 'ldk-node';
    const cdkAvailable =
        !!settings?.ecash?.enableCashu && BackendUtils.supportsCashuWallet();

    const [selections, setSelections] = React.useState<DiagnosticsSelections>({
        settings: true,
        lndLogs: lndAvailable,
        ldkLogs: ldkAvailable,
        cdkLogs: cdkAvailable,
        activity: false
    });
    const [loading, setLoading] = React.useState(false);

    const sections: SectionRow[] = [
        {
            key: 'settings',
            label: localeString('views.Settings.Diagnostics.settings'),
            description: localeString(
                'views.Settings.Diagnostics.settings.description'
            ),
            available: true
        },
        {
            key: 'lndLogs',
            label: localeString('views.Settings.Diagnostics.lndLogs'),
            description: localeString(
                'views.Settings.Diagnostics.lndLogs.description'
            ),
            available: lndAvailable
        },
        {
            key: 'ldkLogs',
            label: localeString('views.Settings.Diagnostics.ldkLogs'),
            description: localeString(
                'views.Settings.Diagnostics.ldkLogs.description'
            ),
            available: ldkAvailable
        },
        {
            key: 'cdkLogs',
            label: localeString('views.Settings.Diagnostics.cdkLogs'),
            description: localeString(
                'views.Settings.Diagnostics.cdkLogs.description'
            ),
            available: cdkAvailable
        },
        {
            key: 'activity',
            label: localeString('views.Settings.Diagnostics.activity'),
            description: localeString(
                'views.Settings.Diagnostics.activity.description'
            ),
            available: true
        }
    ];

    const setSelection = (key: keyof DiagnosticsSelections, value: boolean) =>
        setSelections((prev) => ({ ...prev, [key]: value }));

    const onToggle = (key: keyof DiagnosticsSelections, value: boolean) => {
        // Activity is off by default and warns before enabling.
        if (key === 'activity' && value) {
            Alert.alert(
                localeString(
                    'views.Settings.Diagnostics.activityWarning.title'
                ),
                localeString(
                    'views.Settings.Diagnostics.activityWarning.message'
                ),
                [
                    {
                        text: localeString('general.cancel'),
                        style: 'cancel'
                    },
                    {
                        text: localeString(
                            'views.Settings.Diagnostics.activityWarning.enable'
                        ),
                        onPress: () => setSelection('activity', true)
                    }
                ]
            );
            return;
        }
        setSelection(key, value);
    };

    const doSend = async () => {
        setLoading(true);
        try {
            const report = await collectDiagnostics(selections);
            await shareDiagnostics(report);
        } catch (e: any) {
            Alert.alert(
                localeString('general.error'),
                e?.message ? `${e.message}` : `${e}`
            );
        } finally {
            setLoading(false);
        }
    };

    const onEmailSupport = () => {
        const bullet = '\n• ';
        const included = [
            localeString('views.Settings.Diagnostics.version'),
            selections.settings &&
                localeString('views.Settings.Diagnostics.settings'),
            selections.lndLogs &&
                localeString('views.Settings.Diagnostics.lndLogs'),
            selections.ldkLogs &&
                localeString('views.Settings.Diagnostics.ldkLogs'),
            selections.cdkLogs &&
                localeString('views.Settings.Diagnostics.cdkLogs'),
            selections.activity &&
                localeString('views.Settings.Diagnostics.activity')
        ]
            .filter(Boolean)
            .join(bullet);

        Alert.alert(
            localeString('views.Settings.Diagnostics.confirm.title'),
            `${localeString(
                'views.Settings.Diagnostics.confirm.message'
            )}${bullet}${included}`,
            [
                { text: localeString('general.cancel'), style: 'cancel' },
                {
                    text: localeString(
                        'views.Settings.Diagnostics.emailSupport'
                    ),
                    onPress: doSend
                }
            ]
        );
    };

    return (
        <Screen>
            <Header
                leftComponent="Back"
                centerComponent={{
                    text: localeString('views.Settings.Diagnostics.title'),
                    style: {
                        color: themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book'
                    }
                }}
                navigation={navigation}
            />
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <ListItem.Subtitle
                    style={{
                        color: themeColor('secondaryText'),
                        fontFamily: 'PPNeueMontreal-Book',
                        marginBottom: 16
                    }}
                >
                    {localeString('views.Settings.Diagnostics.explainer')}
                </ListItem.Subtitle>

                {/* Version — always included */}
                <ListItem
                    containerStyle={{
                        borderBottomWidth: 0,
                        backgroundColor: 'transparent',
                        paddingHorizontal: 0
                    }}
                >
                    <ListItem.Content>
                        <ListItem.Title
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {localeString('views.Settings.Diagnostics.version')}
                        </ListItem.Title>
                        <ListItem.Subtitle
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {localeString(
                                'views.Settings.Diagnostics.alwaysIncluded'
                            )}
                        </ListItem.Subtitle>
                    </ListItem.Content>
                    <Icon
                        name="check"
                        color={themeColor('highlight')}
                        size={24}
                    />
                </ListItem>

                {sections.map((s) => (
                    <ListItem
                        key={s.key}
                        containerStyle={{
                            borderBottomWidth: 0,
                            backgroundColor: 'transparent',
                            paddingHorizontal: 0,
                            opacity: s.available ? 1 : 0.5
                        }}
                    >
                        <ListItem.Content>
                            <ListItem.Title
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {s.label}
                            </ListItem.Title>
                            <ListItem.Subtitle
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {s.available
                                    ? s.description
                                    : localeString(
                                          'views.Settings.Diagnostics.notAvailable'
                                      )}
                            </ListItem.Subtitle>
                        </ListItem.Content>
                        <Switch
                            value={s.available && selections[s.key]}
                            onValueChange={(value: boolean) =>
                                onToggle(s.key, value)
                            }
                            disabled={!s.available}
                        />
                    </ListItem>
                ))}
            </ScrollView>

            <View style={{ padding: 16 }}>
                {loading ? (
                    <LoadingIndicator />
                ) : (
                    <Button
                        title={localeString(
                            'views.Settings.Diagnostics.emailSupport'
                        )}
                        onPress={onEmailSupport}
                    />
                )}
            </View>
        </Screen>
    );
}
