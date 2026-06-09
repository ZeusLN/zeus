import React from 'react';
import { Dimensions, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import CircularProgress from 'react-native-circular-progress-indicator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/Button';
import Screen from '../components/Screen';
import Header from '../components/Header';

import SyncStore from '../stores/SyncStore';

import { formatProgressPercentage } from '../utils/FormatUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface SyncRecoveryProps {
    navigation: NativeStackNavigationProp<any, any>;
    SyncStore: SyncStore;
}

@inject('SyncStore')
@observer
export default class SyncRecovery extends React.PureComponent<
    SyncRecoveryProps,
    {}
> {
    render() {
        const { navigation, SyncStore } = this.props;
        const { recoveryProgress } = SyncStore;

        const { width } = Dimensions.get('window');
        const ringRadius = width / 3;
        const ringSize = ringRadius * 2;
        const progressFontSize = ringRadius / 2;
        const progressValue = recoveryProgress
            ? Number(Math.floor(recoveryProgress * 1000) / 1000) * 100
            : 0;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.SyncRecovery.title'),
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
                                value={progressValue}
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
                                    {formatProgressPercentage(progressValue)}%
                                </Text>
                            </View>
                        </View>
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
