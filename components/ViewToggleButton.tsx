import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Animated,
    Easing
} from 'react-native';
import { inject, observer } from 'mobx-react';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import ChannelsStore, { ChannelsView } from '../stores/ChannelsStore';

type ViewToggleButtonView = 'channels' | 'peers';

interface ViewToggleButtonProps {
    ChannelsStore?: ChannelsStore;
    onToggle: (view: ViewToggleButtonView) => void;
}

interface ViewToggleButtonState {
    animation: Animated.Value;
}

const getStyles = (theme: any) =>
    StyleSheet.create({
        container: {
            alignItems: 'center',
            justifyContent: 'center'
        },
        toggleButton: {
            width: 220,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.secondary,
            position: 'relative',
            justifyContent: 'center',
            overflow: 'hidden'
        },
        thumb: {
            position: 'absolute',
            width: 110,
            height: 32,
            borderRadius: 16,
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
            justifyContent: 'space-between',
            paddingHorizontal: 25,
            zIndex: 2
        },
        toggleText: {
            fontSize: 16,
            fontFamily: 'PPNeueMontreal-Book',
            color: theme.secondaryText
        },
        activeText: {
            color: theme.background,
            fontFamily: 'PPNeueMontreal-Medium'
        }
    });

@inject('ChannelsStore')
@observer
class ViewToggleButton extends React.Component<
    ViewToggleButtonProps,
    ViewToggleButtonState
> {
    constructor(props: ViewToggleButtonProps) {
        super(props);

        const initialAnimationValue =
            this.props.ChannelsStore?.channelsView === ChannelsView.Channels
                ? 0
                : 1;

        this.state = {
            animation: new Animated.Value(initialAnimationValue)
        };
    }

    toggleView = (view: ViewToggleButtonView) => {
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
        const theme = {
            secondary: themeColor('secondary'),
            highlight: themeColor('highlight'),
            background: themeColor('background'),
            secondaryText: themeColor('secondaryText'),
            text: themeColor('text')
        };
        const styles = getStyles(theme);

        const translateX = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [4, 106]
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
                        <Text
                            style={[
                                styles.toggleText,
                                activeView === ChannelsView.Channels &&
                                    styles.activeText
                            ]}
                        >
                            {localeString('views.Wallet.Wallet.channels')}
                        </Text>
                        <Text
                            style={[
                                styles.toggleText,
                                activeView === ChannelsView.Peers &&
                                    styles.activeText,
                                { paddingRight: 12 }
                            ]}
                        >
                            {localeString('general.peers')}
                        </Text>
                    </View>
                </TouchableOpacity>
            </View>
        );
    }
}

export default ViewToggleButton;
