import * as React from 'react';
import { inject, observer } from 'mobx-react';

import Button from './../components/Button';

import UnitsStore from './../stores/UnitsStore';
import SettingsStore from './../stores/SettingsStore';

interface UnitToggleProps {
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
    onToggle?: () => void;
}

@inject('UnitsStore', 'SettingsStore')
@observer
export default class UnitToggle extends React.Component<UnitToggleProps, {}> {
    render() {
        const { onToggle } = this.props;
        const { changeUnits, units } = this.props.UnitsStore;
        const { fiat } = this.props.SettingsStore.settings;

        return (
            <React.Fragment>
                <Button
                    title={units === 'fiat' ? fiat : units}
                    icon={{
                        name: 'import-export',
                        size: 25
                    }}
                    adaptiveWidth
                    quinary
                    noUppercase
                    onPress={() => {
                        if (onToggle) onToggle();
                        changeUnits();
                    }}
                />
            </React.Fragment>
        );
    }
}
