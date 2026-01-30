import * as React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';
import { LinearProgress } from '@rneui/themed';
import { StackNavigationProp } from '@react-navigation/stack';

import SyncStore from '../stores/SyncStore';

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
                        borderWidth: 0.5
                    }}
                >
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Medium',
                            color: themeColor('text')
                        }}
                    >
                        {localeString('views.Wallet.BalancePane.sync.title')}
                    </Text>
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            color: themeColor('text'),
                            marginTop: 20
                        }}
                    >
                        {localeString(
                            'views.Wallet.BalancePane.sync.text'
                        ).replace('Zeus', 'ZEUS')}
                    </Text>
                    {currentBlockHeight !== undefined && bestBlockHeight && (
                        <View
                            style={{
                                marginTop: 30,
                                flex: 1,
                                flexDirection: 'row',
                                display: 'flex',
                                justifyContent: 'space-between',
                                minWidth: '100%'
                            }}
                        >
                            <LinearProgress
                                value={
                                    Math.floor(
                                        (currentBlockHeight / bestBlockHeight) *
                                            100
                                    ) / 100
                                }
                                variant="determinate"
                                color={themeColor('highlight')}
                                trackColor={themeColor('secondaryBackground')}
                                style={{
                                    flex: 1,
                                    flexDirection: 'row'
                                }}
                            />
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Medium',
                                    color: themeColor('text'),
                                    marginTop: -8,
                                    marginLeft: 14,
                                    height: 40
                                }}
                            >
                                {`${Math.floor(
                                    (currentBlockHeight / bestBlockHeight) * 100
                                ).toString()}%`}
                            </Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    }
}
