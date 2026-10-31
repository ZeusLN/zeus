import * as React from 'react';
import {
    FlatList,
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import SystemNavigationBar from 'react-native-system-navigation-bar';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import ThemePreview, {
    PREVIEW_ASPECT_RATIO,
    THEME_PREVIEW_VIEWS,
    ThemePreviewView
} from '../../components/ThemePreview';

import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { isLightTheme, themeColor } from '../../utils/ThemeUtils';

import { themeLabel } from './ThemePicker';

// Space under the preview for its caption
const CAPTION_HEIGHT = 40;

const VIEW_LABELS: { [view in ThemePreviewView]: string } = {
    balance: 'views.Settings.Display.DefaultView.balance',
    keypad: 'views.Settings.Display.DefaultView.keypad',
    channels: 'views.Wallet.Wallet.channels',
    receive: 'views.Receive.title'
};

interface ThemeDetailsProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: RouteProp<{ ThemeDetails: { theme: string } }, 'ThemeDetails'>;
    SettingsStore: SettingsStore;
}

interface ThemeDetailsState {
    width: number;
    height: number;
    page: number;
}

@inject('SettingsStore')
@observer
export default class ThemeDetails extends React.Component<
    ThemeDetailsProps,
    ThemeDetailsState
> {
    state = {
        width: 0,
        height: 0,
        page: 0
    };

    onLayout = (event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        this.setState({ width, height });
    };

    onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { width } = this.state;
        if (width <= 0) return;
        this.setState({
            page: Math.round(event.nativeEvent.contentOffset.x / width)
        });
    };

    applyTheme = async () => {
        const { navigation, route, SettingsStore } = this.props;
        const { theme } = route.params;

        await SettingsStore.updateSettingsGroup('display', { theme });
        SystemNavigationBar.setNavigationColor(
            themeColor('background'),
            isLightTheme() ? 'dark' : 'light'
        );
        SystemNavigationBar.setNavigationBarDividerColor(
            themeColor('secondary')
        );
        navigation.goBack();
    };

    render() {
        const { navigation, route, SettingsStore } = this.props;
        const { theme } = route.params;
        const { width, height, page } = this.state;
        const selected = SettingsStore.settings.display?.theme === theme;

        // Largest preview that fits the page with room for its caption
        const previewWidth = Math.min(
            width * 0.8,
            (height - CAPTION_HEIGHT) / PREVIEW_ASPECT_RATIO
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: themeLabel(theme),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={styles.pager} onLayout={this.onLayout}>
                    {previewWidth > 0 && (
                        <FlatList
                            data={THEME_PREVIEW_VIEWS}
                            keyExtractor={(view) => view}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={this.onScrollEnd}
                            getItemLayout={(_, index) => ({
                                length: width,
                                offset: width * index,
                                index
                            })}
                            renderItem={({ item: view }) => (
                                <View style={[styles.page, { width }]}>
                                    <ThemePreview
                                        theme={theme}
                                        view={view}
                                        width={previewWidth}
                                    />
                                    <Text
                                        style={[
                                            styles.caption,
                                            {
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }
                                        ]}
                                    >
                                        {localeString(VIEW_LABELS[view])}
                                    </Text>
                                </View>
                            )}
                        />
                    )}
                </View>
                <View style={styles.dots}>
                    {THEME_PREVIEW_VIEWS.map((view, index) => (
                        <View
                            key={view}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor:
                                        index === page
                                            ? themeColor('highlight')
                                            : themeColor('secondaryText')
                                }
                            ]}
                        />
                    ))}
                </View>
                <View style={styles.button}>
                    <Button
                        title={
                            selected
                                ? localeString('views.Settings.Theme.current')
                                : localeString('views.Settings.Theme.apply')
                        }
                        onPress={this.applyTheme}
                        disabled={
                            selected || SettingsStore.settingsUpdateInProgress
                        }
                    />
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    pager: {
        flex: 1
    },
    page: {
        alignItems: 'center',
        justifyContent: 'center'
    },
    caption: {
        height: CAPTION_HEIGHT - 10,
        marginTop: 10,
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book'
    },
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginVertical: 15
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    button: {
        paddingBottom: 20
    }
});
