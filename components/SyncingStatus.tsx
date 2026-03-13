import * as React from 'react';
import {
    StyleProp,
    Text,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { ParamListBase } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import ConnectivityStore from '../stores/ConnectivityStore';
import SyncStore from '../stores/SyncStore';
import StatusCard from './StatusCard';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import PauseIcon from '../assets/images/SVG/Pause.svg';

interface SyncingStatusProps {
    navigation: NativeStackNavigationProp<ParamListBase>;
    ConnectivityStore?: ConnectivityStore;
    SyncStore?: SyncStore;
    style?: StyleProp<ViewStyle>;
}

@inject('ConnectivityStore', 'SyncStore')
@observer
export default class SyncingStatus extends React.PureComponent<
    SyncingStatusProps,
    {}
> {
    render() {
        const { navigation, ConnectivityStore, SyncStore, style } = this.props;
        const { currentBlockHeight, bestBlockHeight, isSyncing } = SyncStore!;

        if (!isSyncing) {
            return null;
        }

        if (ConnectivityStore!.isOffline) {
            return (
                <TouchableOpacity
                    onPress={() => navigation.navigate('Sync')}
                    style={style || {}}
                >
                    <View
                        style={{
                            backgroundColor: themeColor('secondary'),
                            borderRadius: 10,
                            padding: 15,
                            margin: 20,
                            marginBottom: 10,
                            paddingVertical: 10,
                            flexDirection: 'row',
                            alignItems: 'center'
                        }}
                    >
                        <PauseIcon
                            color={themeColor('text')}
                            width={16}
                            height={16}
                            style={{ marginRight: 8 }}
                        />
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Medium',
                                color: themeColor('text'),
                                fontSize: 14
                            }}
                        >
                            {localeString(
                                'views.Wallet.BalancePane.sync.paused'
                            )}
                        </Text>
                    </View>
                </TouchableOpacity>
            );
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
