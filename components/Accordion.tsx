import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    LayoutChangeEvent,
    ViewStyle,
    TextStyle,
    StyleProp
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withTiming,
    interpolate,
    SharedValue
} from 'react-native-reanimated';

export interface AccordionItemProps {
    isExpanded: SharedValue<boolean>;
    children: React.ReactNode;
    viewKey: string;
    duration?: number;
    style?: StyleProp<ViewStyle>;
}

export interface AccordionProps {
    title: string;
    children: React.ReactNode;
    /** Controlled open state. When provided, the accordion becomes controlled. */
    open?: boolean;
    defaultOpen?: boolean;
    duration?: number;
    headerStyle?: ViewStyle;
    titleStyle?: TextStyle;
    /** Styles applied to the animated body wrapper */
    bodyStyle?: StyleProp<ViewStyle>;
    /** Styles applied to the inner body container (defaults include padding) */
    bodyContentStyle?: StyleProp<ViewStyle>;
    containerStyle?: StyleProp<ViewStyle>;
    /** Optional stable id used for layout measurement keys (defaults to title) */
    id?: string;
    renderHeader?: (isOpen: boolean) => React.ReactNode;
    renderIcon?: (isOpen: boolean) => React.ReactNode;
    /** Called with the new open state whenever the accordion is toggled */
    onToggle?: (isOpen: boolean) => void;
}

export function AccordionItem({
    isExpanded,
    children,
    viewKey,
    duration = 400,
    style
}: AccordionItemProps) {
    const height = useSharedValue(0);

    const derivedHeight = useDerivedValue(() =>
        withTiming(height.value * Number(isExpanded.value), { duration })
    );

    const bodyStyle = useAnimatedStyle(() => ({
        height: derivedHeight.value,
        opacity: interpolate(
            derivedHeight.value,
            [0, height.value || 1],
            [0, 1]
        )
    }));

    const handleLayout = useCallback(
        (e: LayoutChangeEvent) => {
            const measured = e.nativeEvent.layout.height;
            if (measured > 0) {
                height.value = measured;
            }
        },
        [height]
    );

    return (
        <Animated.View
            key={`accordionItem_${viewKey}`}
            style={[styles.animatedView, bodyStyle, style]}
        >
            <View onLayout={handleLayout} style={styles.innerWrapper}>
                {children}
            </View>
        </Animated.View>
    );
}

export function Accordion({
    title,
    children,
    open,
    defaultOpen = false,
    duration = 400,
    headerStyle,
    titleStyle,
    bodyStyle,
    bodyContentStyle,
    containerStyle,
    id,
    renderHeader,
    renderIcon,
    onToggle
}: AccordionProps) {
    const isControlled = open != null;
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const currentOpen = isControlled ? (open as boolean) : uncontrolledOpen;

    const isOpen = useSharedValue<boolean>(currentOpen);

    useEffect(() => {
        isOpen.value = currentOpen;
    }, [currentOpen, isOpen]);

    const viewKey = useMemo(() => id ?? title, [id, title]);

    const toggle = useCallback(() => {
        const next = !isOpen.value;
        isOpen.value = next;
        if (!isControlled) setUncontrolledOpen(next);
        onToggle?.(next);
    }, [isControlled, isOpen, onToggle]);

    return (
        <View style={[styles.container, containerStyle]}>
            <TouchableOpacity
                activeOpacity={0.75}
                onPress={toggle}
                style={[
                    renderHeader ? styles.customHeader : styles.header,
                    headerStyle
                ]}
                accessibilityRole="button"
                accessibilityLabel={title}
                accessibilityHint="Toggles accordion section"
            >
                {renderHeader ? (
                    renderHeader(currentOpen)
                ) : (
                    <>
                        <Text style={[styles.title, titleStyle]}>{title}</Text>
                        {renderIcon ? renderIcon(currentOpen) : null}
                    </>
                )}
            </TouchableOpacity>

            <AccordionItem
                isExpanded={isOpen}
                viewKey={viewKey}
                duration={duration}
                style={bodyStyle}
            >
                <View style={[styles.body, bodyContentStyle]}>{children}</View>
            </AccordionItem>
        </View>
    );
}

const styles = StyleSheet.create({
    animatedView: {
        width: '100%',
        overflow: 'hidden'
    },
    innerWrapper: {
        width: '100%',
        position: 'absolute'
    },
    container: {
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 8,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14
    },
    customHeader: {
        width: '100%'
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
        marginRight: 8
    },
    chevron: {
        fontSize: 20,
        lineHeight: 22
    },
    body: {
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 16
    }
});

export default Accordion;
