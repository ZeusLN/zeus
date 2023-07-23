import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import UrlUtils from '../utils/UrlUtils';

interface MessageProps {
    message?: string;
    fontSize?: number;
    link: string;
    mainStyle: any;
    dismissable?: boolean;
}

const Message = ({
    message,
    fontSize,
    link,
    mainStyle,
    dismissable
}: MessageProps) => {
    const [isDismissed, setDismissed] = useState(false);
    if (isDismissed) return;
    return dismissable ? (
        <TouchableOpacity onPress={() => setDismissed(true)}>
            <Text
                style={[styles.field, mainStyle, { fontSize: fontSize || 20 }]}
            >
                {message}
            </Text>
        </TouchableOpacity>
    ) : link ? (
        <TouchableOpacity onPress={() => UrlUtils.goToUrl(link)}>
            <Text
                style={[styles.field, mainStyle, { fontSize: fontSize || 20 }]}
            >
                {message}
            </Text>
        </TouchableOpacity>
    ) : (
        <Text style={[styles.field, mainStyle, { fontSize: fontSize || 20 }]}>
            {message}
        </Text>
    );
};

const SuccessMessage = ({
    message,
    fontSize,
    link,
    dismissable
}: MessageProps) => (
    <Message
        message={message}
        fontSize={fontSize}
        link={link}
        mainStyle={styles.successField}
        dismissable={dismissable}
    />
);

const WarningMessage = ({
    message,
    fontSize,
    link,
    dismissable
}: MessageProps) => (
    <Message
        message={message}
        fontSize={fontSize}
        link={link}
        mainStyle={styles.warningField}
        dismissable={dismissable}
    />
);

const ErrorMessage = ({
    message,
    fontSize,
    link,
    dismissable
}: MessageProps) => (
    <Message
        message={message}
        fontSize={fontSize}
        link={link}
        mainStyle={styles.errorField}
        dismissable={dismissable}
    />
);

const styles = StyleSheet.create({
    field: {
        fontFamily: 'Lato-Regular',
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
        backgroundColor: '#ffe065'
    },
    errorField: {
        color: '#E14C4C',
        backgroundColor: '#372C33'
    }
});

export { SuccessMessage, WarningMessage, ErrorMessage };
