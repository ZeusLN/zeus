import * as React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import Contact from '../models/Contact';

import { themeColor } from '../utils/ThemeUtils';

interface RecipientDisplayProps {
    contact: Contact | null;
    lightningAddress?: string;
}

export default function RecipientDisplay({
    contact,
    lightningAddress
}: RecipientDisplayProps) {
    if (!contact && !lightningAddress) return null;

    return (
        <View style={styles.container}>
            {contact?.photo && (
                <Image
                    source={{ uri: contact.getPhoto }}
                    style={styles.photo}
                />
            )}
            <Text style={[styles.name, { color: themeColor('text') }]}>
                {contact?.name || lightningAddress}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20
    },
    photo: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10
    },
    name: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book'
    }
});
