import React, { Component } from 'react';
import { TouchableOpacity } from 'react-native';
import { themeColor } from '../utils/ThemeUtils';
import EyeClosed from '../assets/images/SVG/eye_closed.svg';
import EyeOpened from '../assets/images/SVG/eye_opened.svg';

interface ShowHideToggleProps {
    onPress: () => void;
}

interface ShowHideToggleState {
    showHideToggle: boolean;
}

class ShowHideToggle extends Component<
    ShowHideToggleProps,
    ShowHideToggleState
> {
    constructor(props: ShowHideToggleProps) {
        super(props);
        this.state = {
            showHideToggle: false
        };
    }

    handleIconPress = () => {
        this.setState((prevState) => ({
            showHideToggle: !prevState.showHideToggle
        }));
        this.props.onPress();
    };

    render() {
        return (
            <TouchableOpacity onPress={this.handleIconPress}>
                {this.state.showHideToggle ? (
                    <EyeClosed
                        height="18"
                        width="20"
                        fill={themeColor('text')}
                    />
                ) : (
                    <EyeOpened
                        height="18"
                        width="20"
                        fill={themeColor('text')}
                    />
                )}
            </TouchableOpacity>
        );
    }
}

export default ShowHideToggle;
