import * as React from 'react';
import {
    DimensionValue,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { themeColor } from './../utils/ThemeUtils';

interface PillProps {
    title: string;
    textColor?: string;
    borderColor?: string;
    borderWidth?: number;
    backgroundColor?: string;
    width?: DimensionValue;
    height?: DimensionValue;
    onPress?: () => void;
    scrollOnOverflow?: boolean;
}

function Pill(props: PillProps) {
    const {
        title,
        textColor,
        borderColor,
        borderWidth,
        backgroundColor,
        width,
        height,
        onPress,
        scrollOnOverflow
    } = props;

    const wrapperStyle: ViewStyle = {
        ...styles.wrapper,
        borderWidth: borderWidth ? borderWidth : borderColor ? 3 : 0,
        borderColor: borderColor || themeColor('highlight'),
        height: height || 40,
        backgroundColor: backgroundColor || themeColor('background')
    };

    if (width) {
        wrapperStyle.width = width;
    } else if (scrollOnOverflow) {
        wrapperStyle.maxWidth = '100%';
    } else {
        wrapperStyle.width = 90;
    }

    const TextElement = (
        <Text
            style={{
                ...styles.text,
                color: textColor || themeColor('highlight')
            }}
        >
            {title}
        </Text>
    );

    let PillContent;
    if (scrollOnOverflow) {
        PillContent = (
            <ScrollView
                horizontal={true}
                showsHorizontalScrollIndicator={false}
                disallowInterruption={true}
                style={{
                    height: '100%'
                }}
                contentContainerStyle={{
                    alignItems: 'center',
                    paddingHorizontal: 14
                }}
            >
                {TextElement}
            </ScrollView>
        );
    } else {
        PillContent = TextElement;
    }

    if (!onPress) {
        return <View style={wrapperStyle}>{PillContent}</View>;
    }

    return (
        <TouchableOpacity style={wrapperStyle} onPress={onPress}>
            {PillContent}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 50,
        overflow: 'hidden'
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    }
});

export default Pill;
