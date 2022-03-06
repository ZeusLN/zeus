import * as React from 'react';
import { StyleSheet, Text } from 'react-native';

interface MessageProps {
    message?: string;
}

const SuccessMessage = (props: MessageProps) => (
    <Text style={styles.successField}>{props.message}</Text>
);

const ErrorMessage = (props: MessageProps) => (
    <Text style={styles.errorField}>{props.message}</Text>
);

const styles = StyleSheet.create({
    successField: {
        fontFamily: 'Lato-Regular',
        fontSize: 20,
        width: '100%',
        top: 10,
        color: '#41CF3E',
        backgroundColor: '#273832',
        borderRadius: 6,
        marginBottom: 20,
        padding: 15,
        textAlign: 'center'
    },
    errorField: {
        fontFamily: 'Lato-Regular',
        fontSize: 20,
        width: '100%',
        top: 10,
        color: '#E14C4C',
        backgroundColor: '#372C33',
        borderRadius: 6,
        marginBottom: 20,
        padding: 15,
        textAlign: 'center'
    }
});

export { SuccessMessage, ErrorMessage };
