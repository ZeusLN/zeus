import * as React from 'react';
import { TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';

import MatiSvg from './SVG/MatiSvg';

import SettingsStore from '../stores/SettingsStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

export const LURKER_TOGGLE_SIZE = 24;

interface LurkerToggleProps {
    SettingsStore?: SettingsStore;
}

// Turns lurker mode on or off from next to a balance. The crossed out eye
// shows the mode is on, including while a long press reveals the values
// for a few seconds, since the mode comes back on when that ends.
@inject('SettingsStore')
@observer
export default class LurkerToggle extends React.Component<
    LurkerToggleProps,
    {}
> {
    render() {
        const SettingsStore = this.props.SettingsStore!;
        const lurkerMode =
            !!SettingsStore.settings?.privacy?.lurkerMode ||
            SettingsStore.lurkerExposed;

        return (
            <TouchableOpacity
                onPress={() => SettingsStore.setLurkerMode(!lurkerMode)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={localeString(
                    lurkerMode
                        ? 'components.LurkerToggle.disable'
                        : 'components.LurkerToggle.enable'
                )}
            >
                <MatiSvg
                    circle={false}
                    off={lurkerMode}
                    color={themeColor('secondaryText')}
                    width={LURKER_TOGGLE_SIZE}
                    height={LURKER_TOGGLE_SIZE}
                />
            </TouchableOpacity>
        );
    }
}
