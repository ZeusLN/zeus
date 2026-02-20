import * as React from 'react';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import SyncStore from '../stores/SyncStore';
import StatusCard from './StatusCard';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface SyncingStatusProps {
    navigation: StackNavigationProp<any, any>;
    SyncStore?: SyncStore;
    style?: any;
}

@inject('SyncStore')
@observer
export default class SyncingStatus extends React.PureComponent<
    SyncingStatusProps,
    {}
> {
    render() {
        const { navigation, SyncStore, style } = this.props;
        const { currentBlockHeight, bestBlockHeight, isSyncing } = SyncStore!;

        if (!isSyncing) {
            return null;
        }

        const progress =
            currentBlockHeight !== undefined && bestBlockHeight
                ? currentBlockHeight / bestBlockHeight
                : undefined;

        return (
            <StatusCard
                onPress={() => navigation.navigate('Sync')}
                title={localeString('views.Wallet.BalancePane.sync.title')}
                body={localeString(
                    'views.Wallet.BalancePane.sync.text'
                ).replace('Zeus', 'ZEUS')}
                progress={progress}
                backgroundColor={themeColor('secondary')}
                textColor={themeColor('text')}
                progressColor={themeColor('highlight')}
                style={style}
            />
        );
    }
}
