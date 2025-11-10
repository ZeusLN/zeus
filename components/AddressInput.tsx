import * as React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';

import TextInput from './TextInput';
import LoadingIndicator from './LoadingIndicator';

import { themeColor } from '../utils/ThemeUtils';

import Scan from '../assets/images/SVG/Scan.svg';

interface AddressInputProps {
    value: string;
    onChangeText: (text: string) => void;
    onScan: () => void;
    placeholder: string;
    loading?: boolean;
    style?: ViewStyle;
}

const AddressInput: React.FC<AddressInputProps> = ({
    value,
    onChangeText,
    onScan,
    placeholder,
    loading = false,
    style = {}
}) => {
    return (
        <View style={[styles.container, style]}>
            <View style={styles.inputWrapper}>
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                />
                {loading && (
                    <View style={styles.loadingOverlay}>
                        <LoadingIndicator />
                    </View>
                )}
            </View>

            <TouchableOpacity onPress={onScan} style={styles.scanButton}>
                <Scan width={30} height={30} fill={themeColor('text')} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    inputWrapper: {
        flex: 1,
        position: 'relative'
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center'
    },
    scanButton: {
        marginLeft: 10
    }
});

export default AddressInput;
