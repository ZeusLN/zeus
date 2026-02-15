import * as React from 'react';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import SyncStore from '../stores/SyncStore';
import StatusCard from './StatusCard';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface RecoveryStatusProps {
    navigation: StackNavigationProp<any, any>;
    SyncStore?: SyncStore;
    style?: any;
}

@inject('SyncStore')
@observer
export default class RecoveryStatus extends React.PureComponent<
    RecoveryStatusProps,
    {}
> {
    render() {
        const { navigation, SyncStore, style } = this.props;
        const { recoveryProgress, isRecovering } = SyncStore!;

        if (!isRecovering || recoveryProgress === 1) {
            return null;
        }

        const title = `${localeString(
            'views.Wallet.BalancePane.recovery.title'
        )}${
            !recoveryProgress
                ? ` - ${localeString(
                      'views.Wallet.BalancePane.recovery.textAlt'
                  ).replace('Zeus', 'ZEUS')}`
                : ''
        }`;

        return (
            <StatusCard
                onPress={() => {
                    if (recoveryProgress) {
                        navigation.navigate('SyncRecovery');
                    }
                }}
                title={title}
                body={
                    recoveryProgress
                        ? localeString(
                              'views.Wallet.BalancePane.recovery.text'
                          ).replace('Zeus', 'ZEUS')
                        : undefined
                }
                progress={recoveryProgress ? recoveryProgress : undefined}
                backgroundColor={themeColor('highlight')}
                textColor={themeColor('background')}
                progressColor={themeColor('background')}
                style={style}
            />
        );
    }
}
