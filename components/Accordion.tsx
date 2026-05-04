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
    Easing,
    useAnimatedStyle,
    useAnimatedReaction,
    useSharedValue,
    withTiming,
    interpolate,
    SharedValue
} from 'react-native-reanimated';

import CaretDown from '../assets/images/SVG/Caret Down.svg';
import CaretRight from '../assets/images/SVG/Caret Right.svg';
import KeyValue from './KeyValue';
import { Row } from './layout/Row';
import { themeColor } from '../utils/ThemeUtils';

const MIN_DURATION_MS = 220;
const MAX_DURATION_MS = 420;
const EASING = Easing.bezier(0.25, 0.1, 0.25, 1); // gentle ease-in-out

function getAnimationDuration(contentHeight: number): number {
    'worklet';
    // ~0.6ms per pixel, clamped to [220, 420]
    return Math.round(
        Math.min(
            MAX_DURATION_MS,
            Math.max(MIN_DURATION_MS, contentHeight * 0.6 + 160)
        )
    );
}

const formHeaderBase: ViewStyle = {
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginBottom: 10
};

const formBodyContentBase: ViewStyle = {
    paddingHorizontal: 0
};

function FormHeaderCaret({ isOpen }: { isOpen: boolean }) {
    return isOpen ? (
        <CaretDown fill={themeColor('text')} width="20" height="20" />
    ) : (
        <CaretRight fill={themeColor('text')} width="20" height="20" />
    );
}

type AccordionItemProps = {
    isExpanded: SharedValue<boolean>;
    children: React.ReactNode;
    viewKey: string;
};

function AccordionItem({ isExpanded, children, viewKey }: AccordionItemProps) {
    const height = useSharedValue(0);
    const animatedHeight = useSharedValue(0);

    useAnimatedReaction(
        () => ({ isOpen: isExpanded.value, h: height.value }),
        (current, previous) => {
            if (current.h === 0) return; // not measured yet

            const target = current.isOpen ? current.h : 0;

            if (previous === null || previous.h === 0) {
                // First time we have a real measurement: snap, no animation
                animatedHeight.value = target;
                return;
            }

            if (current.isOpen !== previous.isOpen) {
                // User toggled: run the timed animation
                animatedHeight.value = withTiming(target, {
                    duration: getAnimationDuration(current.h),
                    easing: EASING
                });
            } else if (current.h !== previous.h && current.isOpen) {
                animatedHeight.value = current.h;
            }
        }
    );

    const bodyStyle = useAnimatedStyle(() => ({
        height: animatedHeight.value,
        opacity:
            height.value === 0
                ? 0
                : interpolate(
                      animatedHeight.value,
                      [0, Math.max(height.value, 1)],
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
            style={[styles.animatedView, bodyStyle]}
        >
            <View onLayout={handleLayout} style={styles.innerWrapper}>
                {children}
            </View>
        </Animated.View>
    );
}

export interface AccordionProps {
    title: string;
    children: React.ReactNode;
    open?: boolean;
    defaultOpen?: boolean;
    variant?: 'card' | 'flat';
    spacing?: 'default' | 'none';
    bodyPadded?: boolean;
    /** Flat layout, no outer margin, unpadded body (list / nested accordions). */
    embedded?: boolean;
    /**
     * Form-style accordion: same layout as embedded, plus default header row
     * (KeyValue title + caret). Override with `renderHeader` or customize the
     * title side with `renderFormTitle`.
     */
    headerLayout?: 'standard' | 'form';
    headerStyle?: ViewStyle;
    titleStyle?: TextStyle;
    bodyContentStyle?: StyleProp<ViewStyle>;
    containerStyle?: StyleProp<ViewStyle>;
    id?: string;
    /** Replaces the entire header (no default title or caret). */
    renderHeader?: (isOpen: boolean) => React.ReactNode;
    /** When headerLayout is form and renderHeader is omitted, custom title row only; caret stays on the right. */
    renderFormTitle?: (isOpen: boolean) => React.ReactNode;
    onToggle?: (isOpen: boolean) => void;
    disabled?: boolean;
}

export function Accordion({
    title,
    children,
    open,
    defaultOpen = false,
    variant = 'card',
    spacing = 'default',
    bodyPadded = true,
    embedded = false,
    headerLayout = 'standard',
    headerStyle,
    titleStyle,
    bodyContentStyle,
    containerStyle,
    id,
    renderHeader,
    renderFormTitle,
    onToggle,
    disabled = false
}: AccordionProps) {
    const isControlled = open != null;
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const currentOpen = isControlled ? (open as boolean) : uncontrolledOpen;

    const isOpen = useSharedValue<boolean>(currentOpen);

    useEffect(() => {
        isOpen.value = currentOpen;
    }, [currentOpen, isOpen]);

    const viewKey = useMemo(() => id ?? title, [id, title]);

    const useFormLayout = headerLayout === 'form';
    const useEmbeddedLayout = embedded || useFormLayout;

    const resolvedVariant = useEmbeddedLayout ? 'flat' : variant;
    const resolvedSpacing = useEmbeddedLayout ? 'none' : spacing;
    const resolvedBodyPadded = useEmbeddedLayout ? false : bodyPadded;

    const mergedHeaderStyle = useMemo(() => {
        if (!useFormLayout) return headerStyle;
        return StyleSheet.flatten([formHeaderBase, headerStyle]) as ViewStyle;
    }, [headerStyle, useFormLayout]);

    const mergedBodyContentStyle = useMemo((): StyleProp<ViewStyle> => {
        if (!useFormLayout) return bodyContentStyle;
        return [formBodyContentBase, bodyContentStyle];
    }, [bodyContentStyle, useFormLayout]);

    const formDefaultHeader = useCallback(
        (isExpanded: boolean) => (
            <Row justify="space-between">
                <View style={{ flex: 1 }}>
                    {renderFormTitle ? (
                        renderFormTitle(isExpanded)
                    ) : (
                        <KeyValue keyValue={title} />
                    )}
                </View>
                <FormHeaderCaret isOpen={isExpanded} />
            </Row>
        ),
        [renderFormTitle, title]
    );

    const resolvedRenderHeader = useMemo(() => {
        if (renderHeader) return renderHeader;
        if (useFormLayout) return formDefaultHeader;
        return undefined;
    }, [formDefaultHeader, renderHeader, useFormLayout]);

    const resolvedContainerStyle = useMemo(() => {
        const styleList: Array<StyleProp<ViewStyle>> = [styles.containerBase];

        if (resolvedVariant === 'flat') {
            styleList.push(styles.containerFlat);
        } else {
            styleList.push(styles.containerCard);
        }

        styleList.push(
            resolvedSpacing === 'none'
                ? styles.containerSpacingNone
                : styles.containerSpacingDefault
        );

        if (containerStyle) styleList.push(containerStyle);
        return styleList;
    }, [containerStyle, resolvedSpacing, resolvedVariant]);

    const toggle = useCallback(() => {
        if (disabled) return;
        const next = !isOpen.value;
        isOpen.value = next;
        if (!isControlled) setUncontrolledOpen(next);
        onToggle?.(next);
    }, [disabled, isControlled, isOpen, onToggle]);

    return (
        <View style={resolvedContainerStyle}>
            <TouchableOpacity
                activeOpacity={0.75}
                disabled={disabled}
                onPress={toggle}
                style={[
                    resolvedRenderHeader ? styles.customHeader : styles.header,
                    mergedHeaderStyle
                ]}
                accessibilityRole="button"
                accessibilityLabel={title}
                accessibilityHint="Toggles accordion section"
                accessibilityState={{ disabled, expanded: currentOpen }}
            >
                {resolvedRenderHeader ? (
                    resolvedRenderHeader(currentOpen)
                ) : (
                    <Text style={[styles.title, titleStyle]}>{title}</Text>
                )}
            </TouchableOpacity>

            <AccordionItem isExpanded={isOpen} viewKey={viewKey}>
                <View
                    style={[
                        resolvedBodyPadded ? styles.body : undefined,
                        mergedBodyContentStyle
                    ]}
                >
                    {children}
                </View>
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
    containerBase: {
        width: '100%'
    },
    containerCard: {
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden'
    },
    containerFlat: {
        width: '100%',
        borderRadius: 0,
        overflow: 'visible'
    },
    containerSpacingDefault: {
        marginBottom: 8
    },
    containerSpacingNone: {
        marginBottom: 0
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
    body: {
        paddingHorizontal: 16,
        paddingTop: 0,
        paddingBottom: 16
    }
});

export default Accordion;
