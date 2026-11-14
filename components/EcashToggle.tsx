import * as React from 'react';
import { inject, observer } from 'mobx-react';

import Button from '../components/Button';

import { localeString } from '../utils/LocaleUtils';

interface EcashToggleProps {
    ecashMode?: boolean;
    onToggle?: () => void;
    testID?: string;
}

@inject('UnitsStore', 'SettingsStore')
@observer
export default class EcashToggle extends React.Component<EcashToggleProps, {}> {
    render() {
        const { ecashMode, onToggle, testID } = this.props;

        return (
            <React.Fragment>
                <Button
                    testID={testID}
                    title={
                        ecashMode
                            ? localeString('general.ecash')
                            : localeString('general.selfCustody')
                    }
                    adaptiveWidth
                    secondary
                    noUppercase
                    onPress={() => {
                        if (onToggle) onToggle();
                    }}
                    buttonStyle={{
                        height: 42
                    }}
                />
            </React.Fragment>
        );
    }
}
