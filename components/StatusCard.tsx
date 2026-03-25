import * as React from 'react';
import {
    StyleProp,
    Text,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';
import { LinearProgress } from '@rneui/themed';

import { themeColor } from '../utils/ThemeUtils';

interface StatusCardProps {
    onPress: () => void;
    title: string;
    body?: string;
    progress?: number;
    backgroundColor?: string;
    textColor?: string;
    progressColor?: string;
    style?: StyleProp<ViewStyle>;
}

export default function StatusCard({
    onPress,
    title,
    body,
    progress,
    backgroundColor = themeColor('secondary'),
    textColor = themeColor('text'),
    progressColor = themeColor('highlight'),
    style
}: StatusCardProps) {
    return (
        <TouchableOpacity onPress={onPress} style={style || {}}>
            <View
                style={{
                    backgroundColor,
                    borderRadius: 10,
                    padding: 15,
                    marginHorizontal: 20,
                    marginVertical: 8
                }}
            >
                <Text
                    style={{
                        fontFamily: 'PPNeueMontreal-Medium',
                        color: textColor
                    }}
                >
                    {title}
                </Text>
                {body && (
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            color: textColor,
                            marginTop: 20
                        }}
                    >
                        {body}
                    </Text>
                )}
                {progress !== undefined && progress !== null && (
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
                            value={Math.floor(progress * 100) / 100}
                            variant="determinate"
                            color={progressColor}
                            trackColor={themeColor('secondaryBackground')}
                            style={{
                                flex: 1,
                                flexDirection: 'row'
                            }}
                        />
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Medium',
                                color: textColor,
                                marginTop: -8,
                                marginLeft: 14,
                                height: 40
                            }}
                        >
                            {`${Math.floor(progress * 100).toString()}%`}
                        </Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}
