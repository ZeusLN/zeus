import React from 'react';
import { View } from 'react-native';
import { inject, observer } from 'mobx-react';
import CircularProgress from 'react-native-circular-progress-indicator';

import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';
import Header from '../components/Header';

import SyncStore from '../stores/SyncStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface SyncProps {
    navigation: any;
    SyncStore: SyncStore;
}

@inject('SyncStore')
@observer
export default class Sync extends React.PureComponent<SyncProps, {}> {
    render() {
        const { navigation, SyncStore } = this.props;
        const { bestBlockHeight, currentBlockHeight, numBlocksUntilSynced } =
            SyncStore;
        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Sync.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={{ margin: 10, flex: 1, marginTop: '35%' }}>
                    <View style={{ alignSelf: 'center', marginBottom: 40 }}>
                        <CircularProgress
                            value={Number(
                                (currentBlockHeight / bestBlockHeight) * 100
                            )}
                            radius={120}
                            inActiveStrokeOpacity={0.5}
                            activeStrokeWidth={15}
                            inActiveStrokeWidth={20}
                            progressValueStyle={{
                                fontWeight: '100',
                                color: 'white'
                            }}
                            activeStrokeColor={themeColor('highlight')}
                            activeStrokeSecondaryColor={themeColor('error')}
                            inActiveStrokeColor={themeColor(
                                'secondaryBackground'
                            )}
                            duration={500}
                            dashedStrokeConfig={{
                                count: 50,
                                width: 4
                            }}
                            progressFormatter={(value: number) => {
                                'worklet';
                                return (value.toFixed && value.toFixed(1)) || 0; // 2 decimal places
                            }}
                            valueSuffix="%"
                        />
                    </View>

                    <KeyValue
                        keyValue={localeString('views.Sync.currentBlockHeight')}
                        value={currentBlockHeight}
                    />
                    <KeyValue
                        keyValue={localeString('views.Sync.tip')}
                        value={bestBlockHeight}
                    />
                    <KeyValue
                        keyValue={localeString(
                            'views.Sync.numBlocksUntilSynced'
                        )}
                        value={numBlocksUntilSynced}
                    />
                </View>
            </Screen>
        );
    }
}
