import * as React from 'react';
import { StyleSheet, Text } from 'react-native';

interface MessageProps {
    message?: string;
}

const SuccessMessage = (props: MessageProps) => (
    <Text style={[styles.field, styles.successField]}>{props.message}</Text>
);

const WarningMessage = (props: MessageProps) => (
    <Text style={[styles.field, styles.warningField]}>{props.message}</Text>
);

const ErrorMessage = (props: MessageProps) => (
    <Text style={[styles.field, styles.errorField]}>{props.message}</Text>
);

const styles = StyleSheet.create({
    field: {
        fontFamily: 'Lato-Regular',
        fontSize: 20,
        width: '100%',
        top: 10,
        borderRadius: 6,
        marginBottom: 20,
        padding: 15,
        textAlign: 'center'
    },
    successField: {
        color: '#41CF3E',
        backgroundColor: '#273832'
    },
    warningField: {
        color: '#000',
        backgroundColor: '#FFD93F'
    },
    errorField: {
        color: '#E14C4C',
        backgroundColor: '#372C33'
    }
});

export { SuccessMessage, WarningMessage, ErrorMessage };
