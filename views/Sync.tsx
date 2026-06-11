import React from 'react';
import { View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/Button';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';
import Header from '../components/Header';
import SyncCircularProgress from '../components/SyncCircularProgress';

import SyncStore from '../stores/SyncStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import { numberWithCommas } from '../utils/UnitsUtils';

interface SyncProps {
    navigation: NativeStackNavigationProp<any, any>;
    SyncStore: SyncStore;
}

@inject('SyncStore')
@observer
export default class Sync extends React.PureComponent<SyncProps, {}> {
    render() {
        const { navigation, SyncStore } = this.props;
        const { bestBlockHeight, currentBlockHeight, numBlocksUntilSynced } =
            SyncStore;

        const syncPercent =
            currentBlockHeight && bestBlockHeight
                ? Number(
                      Math.floor(
                          (currentBlockHeight / bestBlockHeight) * 1000
                      ) / 1000
                  ) * 100
                : 0;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Sync.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <View style={{ alignItems: 'center', marginBottom: 40 }}>
                        <SyncCircularProgress value={syncPercent} />
                    </View>

                    <View
                        style={{ marginLeft: 20, marginRight: 20, height: 140 }}
                    >
                        {currentBlockHeight != null ? (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Sync.currentBlockHeight'
                                )}
                                value={numberWithCommas(currentBlockHeight)}
                            />
                        ) : null}
                        {bestBlockHeight != null ? (
                            <KeyValue
                                keyValue={localeString('views.Sync.tip')}
                                value={numberWithCommas(bestBlockHeight)}
                            />
                        ) : null}
                        {!!numBlocksUntilSynced && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Sync.numBlocksUntilSynced'
                                )}
                                value={numberWithCommas(numBlocksUntilSynced)}
                            />
                        )}
                    </View>
                </View>
                <View style={{ bottom: 15 }}>
                    <Button
                        title={localeString('general.goBack')}
                        onPress={() => navigation.goBack()}
                    />
                </View>
            </Screen>
        );
    }
}
