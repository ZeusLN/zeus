import * as React from 'react';
import {
    FlatList,
    LayoutChangeEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Icon } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Header from '../../components/Header';
import Screen from '../../components/Screen';
import ThemePreview from '../../components/ThemePreview';

import SettingsStore, { THEME_KEYS } from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

const COLUMNS = 2;
const PADDING = 15;
const GAP = 15;

export function themeLabel(value?: string): string {
    const theme = THEME_KEYS.find((item) => item.value === value);
    if (!theme) return value || '';
    return theme.translateKey ? localeString(theme.translateKey) : theme.key;
}

interface ThemePickerProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface ThemePickerState {
    width: number;
}

@inject('SettingsStore')
@observer
export default class ThemePicker extends React.Component<
    ThemePickerProps,
    ThemePickerState
> {
    state = {
        width: 0
    };

    onLayout = (event: LayoutChangeEvent) =>
        this.setState({ width: event.nativeEvent.layout.width });

    render() {
        const { navigation, SettingsStore } = this.props;
        const { width } = this.state;
        const selectedTheme = SettingsStore.settings.display?.theme;
        const itemWidth = (width - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Theme.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={styles.container} onLayout={this.onLayout}>
                    {itemWidth > 0 && (
                        <FlatList
                            data={THEME_KEYS}
                            keyExtractor={(item) => item.value}
                            numColumns={COLUMNS}
                            contentContainerStyle={styles.list}
                            columnWrapperStyle={styles.column}
                            initialNumToRender={4}
                            windowSize={5}
                            renderItem={({ item }) => {
                                const selected = item.value === selectedTheme;
                                const label = themeLabel(item.value);
                                return (
                                    <TouchableOpacity
                                        style={{ width: itemWidth }}
                                        onPress={() =>
                                            navigation.navigate(
                                                'ThemeDetails',
                                                { theme: item.value }
                                            )
                                        }
                                        accessibilityRole="button"
                                        accessibilityLabel={label}
                                        accessibilityState={{ selected }}
                                        testID={`theme-${item.value}`}
                                    >
                                        <View
                                            style={[
                                                styles.previewBorder,
                                                {
                                                    borderColor: selected
                                                        ? themeColor(
                                                              'highlight'
                                                          )
                                                        : 'transparent'
                                                }
                                            ]}
                                        >
                                            <ThemePreview
                                                theme={item.value}
                                                view="balance"
                                                width={itemWidth - 6}
                                            />
                                        </View>
                                        <View style={styles.labelRow}>
                                            <Text
                                                style={[
                                                    styles.label,
                                                    {
                                                        color: themeColor(
                                                            'text'
                                                        )
                                                    }
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {label}
                                            </Text>
                                            {selected && (
                                                <Icon
                                                    name="check"
                                                    size={20}
                                                    color={themeColor(
                                                        'highlight'
                                                    )}
                                                />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    list: {
        padding: PADDING
    },
    column: {
        gap: GAP,
        marginBottom: 20
    },
    previewBorder: {
        borderWidth: 2,
        borderRadius: 16,
        padding: 1
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8
    },
    label: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book',
        marginRight: 4
    }
});
