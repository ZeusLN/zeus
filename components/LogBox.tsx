import React, { useRef, useState } from 'react';
import { NativeScrollEvent, ScrollView, Text, ViewStyle } from 'react-native';
import { themeColor } from '../utils/ThemeUtils';

interface ILndLogBoxProps {
    text: string;
    style?: ViewStyle;
    scrollLock?: boolean;
}
export default function LogBox(props: ILndLogBoxProps) {
    const logScrollView = useRef<ScrollView>(null);
    const [scrollViewAtTheEnd, setScrollViewAtTheEnd] = useState(true);

    const isCloseToBottom = ({
        layoutMeasurement,
        contentOffset,
        contentSize
    }: NativeScrollEvent) => {
        if (!props.scrollLock) {
            return true;
        }
        const paddingToBottom = 170;
        return (
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - paddingToBottom
        );
    };

    return (
        <ScrollView
            style={props.style}
            ref={logScrollView}
            contentContainerStyle={{ padding: 8 }}
            onContentSizeChange={() => {
                if (scrollViewAtTheEnd) {
                    logScrollView.current?.scrollToEnd();
                }
            }}
            onScroll={({ nativeEvent }) => {
                setScrollViewAtTheEnd(isCloseToBottom(nativeEvent));
            }}
            scrollEventThrottle={450}
            removeClippedSubviews={true}
        >
            <Text
                selectable={true}
                style={{ fontSize: 13, color: themeColor('text') }}
            >
                {props.text}
            </Text>
        </ScrollView>
    );
}
