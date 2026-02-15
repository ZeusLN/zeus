import * as React from 'react';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import SyncStore from '../stores/SyncStore';
import StatusCard from './StatusCard';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface RescanStatusProps {
    navigation: StackNavigationProp<any, any>;
    SyncStore?: SyncStore;
    style?: any;
}

@inject('SyncStore')
@observer
export default class RescanStatus extends React.PureComponent<
    RescanStatusProps,
    {}
> {
    render() {
        const { navigation, SyncStore, style } = this.props;
        const {
            isRescanning,
            rescanStartHeight,
            rescanCurrentHeight,
            bestBlockHeight
        } = SyncStore!;

        if (!isRescanning) {
            return null;
        }

        const rescanProgress =
            rescanCurrentHeight !== null &&
            rescanStartHeight !== null &&
            bestBlockHeight !== null &&
            bestBlockHeight > rescanStartHeight
                ? Math.min(
                      1,
                      (rescanCurrentHeight - rescanStartHeight) /
                          (bestBlockHeight - rescanStartHeight)
                  )
                : null;

        return (
            <StatusCard
                onPress={() => navigation.navigate('LNDLogs')}
                title={localeString('views.Wallet.BalancePane.rescan.title')}
                body={localeString(
                    'views.Wallet.BalancePane.rescan.text'
                ).replace('Zeus', 'ZEUS')}
                progress={rescanProgress ?? undefined}
                backgroundColor={themeColor('secondary')}
                textColor={themeColor('text')}
                progressColor={themeColor('highlight')}
                style={style}
            />
        );
    }
}
