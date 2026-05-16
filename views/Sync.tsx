import React from 'react';
import { Dimensions, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import CircularProgress from 'react-native-circular-progress-indicator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

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

        const { width } = Dimensions.get('window');
        const ringRadius = width / 3;
        const ringSize = ringRadius * 2;
        const progressFontSize = ringRadius / 2;
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
                        <View
                            style={{
                                width: ringSize,
                                height: ringSize,
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <CircularProgress
                                value={syncPercent}
                                radius={ringRadius}
                                showProgressValue={false}
                                inActiveStrokeOpacity={0.5}
                                activeStrokeWidth={width / 20}
                                inActiveStrokeWidth={width / 40}
                                activeStrokeColor={themeColor('highlight')}
                                activeStrokeSecondaryColor={themeColor('error')}
                                inActiveStrokeColor={themeColor(
                                    'secondaryBackground'
                                )}
                                duration={500}
                            />
                            <View
                                pointerEvents="none"
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    top: 0,
                                    bottom: 0,
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                <Text
                                    style={{
                                        fontWeight: '100',
                                        color: themeColor('text'),
                                        fontSize: progressFontSize,
                                        textAlign: 'center',
                                        lineHeight: Math.ceil(
                                            progressFontSize * 1.05
                                        )
                                    }}
                                >
                                    {formatProgressPercentage(syncPercent)}%
                                </Text>
                            </View>
                        </View>
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
