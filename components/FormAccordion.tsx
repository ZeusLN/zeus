import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import CaretDown from '../assets/images/SVG/Caret Down.svg';
import CaretRight from '../assets/images/SVG/Caret Right.svg';
import Accordion from './Accordion';
import KeyValue from './KeyValue';
import { Row } from './layout/Row';
import { themeColor } from '../utils/ThemeUtils';

function FormAccordionCaret({ isOpen }: { isOpen: boolean }) {
    return isOpen ? (
        <CaretDown fill={themeColor('text')} width="20" height="20" />
    ) : (
        <CaretRight fill={themeColor('text')} width="20" height="20" />
    );
}

export const formAccordionHeaderBase: ViewStyle = {
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginBottom: 10
};

export const formAccordionBodyContentBase: ViewStyle = {
    paddingHorizontal: 0
};

export interface FormAccordionProps {
    id: string;
    title: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
    disabled?: boolean;
    /** Replaces the entire header (no automatic caret). Use `renderHeaderContent` for custom title row + default carets. */
    renderHeader?: (isOpen: boolean) => React.ReactNode;
    /** Main header area only; FormAccordion wraps with `Row` + default trailing caret. */
    renderHeaderContent?: (isOpen: boolean) => React.ReactNode;
    containerStyle?: ViewStyle;
    headerStyle?: ViewStyle;
    bodyContentStyle?: ViewStyle;
}

export function FormAccordion({
    id,
    title,
    defaultOpen = false,
    children,
    disabled,
    renderHeader,
    renderHeaderContent,
    containerStyle,
    headerStyle,
    bodyContentStyle
}: FormAccordionProps) {
    const resolvedHeaderStyle = StyleSheet.flatten([
        formAccordionHeaderBase,
        headerStyle
    ]) as ViewStyle;

    const resolvedBodyStyle = StyleSheet.flatten([
        formAccordionBodyContentBase,
        bodyContentStyle
    ]) as ViewStyle;

    const formHeaderWithCaret = (isOpen: boolean) => (
        <Row justify="space-between">
            <View style={{ flex: 1 }}>
                {renderHeaderContent ? (
                    renderHeaderContent(isOpen)
                ) : (
                    <KeyValue keyValue={title} />
                )}
            </View>
            <FormAccordionCaret isOpen={isOpen} />
        </Row>
    );

    return (
        <Accordion
            id={id}
            title={title}
            defaultOpen={defaultOpen}
            disabled={disabled}
            variant="flat"
            spacing="none"
            bodyPadded={false}
            containerStyle={containerStyle}
            headerStyle={resolvedHeaderStyle}
            bodyContentStyle={resolvedBodyStyle}
            renderHeader={renderHeader ?? formHeaderWithCaret}
        >
            {children}
        </Accordion>
    );
}

export default FormAccordion;
