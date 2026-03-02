import React from 'react';
import { Dimensions, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import CircularProgress from 'react-native-circular-progress-indicator';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../components/Button';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';
import Header from '../components/Header';

import SyncStore from '../stores/SyncStore';

import { formatProgressPercentage } from '../utils/FormatUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import { numberWithCommas } from '../utils/UnitsUtils';

interface SyncProps {
    navigation: StackNavigationProp<any, any>;
    SyncStore: SyncStore;
}

@inject('SyncStore')
@observer
export default class Sync extends React.PureComponent<SyncProps, {}> {
    render() {
        const { navigation, SyncStore } = this.props;
        const { bestBlockHeight, currentBlockHeight, numBlocksUntilSynced } =
            SyncStore;

        const { width } = Dimensions.get('window');

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
                        <CircularProgress
                            value={
                                currentBlockHeight && bestBlockHeight
                                    ? Number(
                                          Math.floor(
                                              (currentBlockHeight /
                                                  bestBlockHeight) *
                                                  1000
                                          ) / 1000
                                      ) * 100
                                    : 0
                            }
                            radius={width / 3}
                            inActiveStrokeOpacity={0.5}
                            activeStrokeWidth={width / 20}
                            inActiveStrokeWidth={width / 40}
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
                            progressFormatter={formatProgressPercentage}
                            valueSuffix="%"
                        />
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
