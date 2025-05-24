import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Animated,
    Easing,
    Dimensions
} from 'react-native';
import { inject, observer } from 'mobx-react';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import ChannelsStore, { ChannelsView } from '../stores/ChannelsStore';

type ToggleButtonView = 'channels' | 'peers';

interface ToggleButtonProps {
    ChannelsStore?: ChannelsStore;
    onToggle: (view: ToggleButtonView) => void;
}

interface ToggleButtonState {
    animation: Animated.Value;
}

@inject('ChannelsStore')
@observer
class ToggleButton extends React.Component<
    ToggleButtonProps,
    ToggleButtonState
> {
    constructor(props: ToggleButtonProps) {
        super(props);

        const initialAnimationValue =
            this.props.ChannelsStore?.channelsView === ChannelsView.Channels
                ? 0
                : 1;

        this.state = {
            animation: new Animated.Value(initialAnimationValue)
        };
    }

    toggleView = (view: ToggleButtonView) => {
        const { ChannelsStore, onToggle } = this.props;
        const currentView = ChannelsStore?.channelsView;

        if (view !== currentView) {
            ChannelsStore?.setChannelsView(view as ChannelsView);

            Animated.timing(this.state.animation, {
                toValue: view === 'channels' ? 0 : 1,
                duration: 200,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true
            }).start();

            onToggle(view);
        }
    };

    render() {
        const { animation } = this.state;
        const activeView = this.props.ChannelsStore?.channelsView;

        const screenWidth = Dimensions.get('window').width;
        const horizontalPadding = 32;
        const toggleWidth = screenWidth - horizontalPadding;
        const thumbWidth = toggleWidth / 2;

        const theme = {
            secondary: themeColor('secondary'),
            highlight: themeColor('highlight'),
            background: themeColor('background'),
            secondaryText: themeColor('secondaryText'),
            text: themeColor('text')
        };

        const styles = getStyles(theme, toggleWidth, thumbWidth);

        const translateX = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [2, thumbWidth + 2]
        });

        return (
            <View style={styles.container}>
                <TouchableOpacity
                    style={styles.toggleButton}
                    activeOpacity={0.8}
                    onPress={() =>
                        this.toggleView(
                            activeView === ChannelsView.Channels
                                ? ChannelsView.Peers
                                : ChannelsView.Channels
                        )
                    }
                >
                    <Animated.View
                        style={[styles.thumb, { transform: [{ translateX }] }]}
                    />
                    <View style={styles.labelContainer}>
                        <View style={styles.label}>
                            <Text
                                style={[
                                    styles.toggleText,
                                    activeView === ChannelsView.Channels &&
                                        styles.activeText
                                ]}
                            >
                                {localeString('views.Wallet.Wallet.channels')}
                            </Text>
                        </View>
                        <View style={styles.label}>
                            <Text
                                style={[
                                    styles.toggleText,
                                    activeView === ChannelsView.Peers &&
                                        styles.activeText
                                ]}
                            >
                                {localeString('general.peers')}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        );
    }
}

const getStyles = (theme: any, toggleWidth: number, thumbWidth: number) =>
    StyleSheet.create({
        container: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 16
        },
        toggleButton: {
            width: toggleWidth,
            height: 40,
            borderRadius: 8,
            backgroundColor: theme.secondary,
            position: 'relative',
            justifyContent: 'center',
            overflow: 'hidden'
        },
        thumb: {
            position: 'absolute',
            width: thumbWidth,
            height: 36,
            borderRadius: 8,
            backgroundColor: theme.text,
            top: 2,
            left: 0,
            elevation: 2,
            shadowColor: theme.background,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2,
            shadowRadius: 1
        },
        labelContainer: {
            flexDirection: 'row',
            zIndex: 2
        },
        label: {
            width: thumbWidth,
            justifyContent: 'center',
            alignItems: 'center'
        },
        toggleText: {
            fontSize: 16,
            fontFamily: 'PPNeueMontreal-Book',
            color: theme.secondaryText,
            textAlign: 'center'
        },
        activeText: {
            color: theme.background,
            fontFamily: 'PPNeueMontreal-Medium'
        }
    });

export default ToggleButton;
