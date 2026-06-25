import React from 'react';
import { Dimensions, Text, View } from 'react-native';
import CircularProgress from 'react-native-circular-progress-indicator';

import { formatProgressPercentage } from '../utils/FormatUtils';
import { themeColor } from '../utils/ThemeUtils';

interface SyncCircularProgressProps {
    value: number;
}

export default function SyncCircularProgress({
    value
}: SyncCircularProgressProps) {
    const { width } = Dimensions.get('window');
    const ringRadius = width / 3;
    const ringSize = ringRadius * 2;
    const progressFontSize = ringRadius / 2;

    return (
        <View
            style={{
                width: ringSize,
                height: ringSize,
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <CircularProgress
                value={value}
                radius={ringRadius}
                showProgressValue={false}
                inActiveStrokeOpacity={0.5}
                activeStrokeWidth={width / 20}
                inActiveStrokeWidth={width / 40}
                activeStrokeColor={themeColor('highlight')}
                activeStrokeSecondaryColor={themeColor('error')}
                inActiveStrokeColor={themeColor('secondaryBackground')}
                duration={500}
            />
            <View
                style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    alignItems: 'center'
                }}
            >
                <Text
                    style={{
                        fontWeight: '100',
                        color: themeColor('text'),
                        fontSize: progressFontSize,
                        textAlign: 'center'
                    }}
                >
                    {formatProgressPercentage(value)}%
                </Text>
            </View>
        </View>
    );
}
