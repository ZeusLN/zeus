import * as React from 'react';
import {
    Platform,
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    ActionSheetIOS
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { themeColor } from '../utils/ThemeUtils';
import CaretDown from '../assets/images/SVG/Caret Down.svg';

interface Item {
    label: string;
    value: string;
}

interface DropdownInputProps {
    items: Item[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

const DropdownInput: React.FC<DropdownInputProps> = ({
    items,
    value,
    onValueChange,
    placeholder = 'Select an option',
    disabled = false
}) => {
    // Find the current selected item for display
    const selectedItem = items.find((item) => item.value === value);
    const displayText = selectedItem ? selectedItem.label : placeholder;

    // For iOS action sheet
    const showIOSPicker = () => {
        if (disabled) return;

        const options = ['Cancel', ...items.map((item) => item.label)];

        ActionSheetIOS.showActionSheetWithOptions(
            {
                options,
                cancelButtonIndex: 0
            },
            (buttonIndex) => {
                if (buttonIndex === 0) return; // Cancel
                onValueChange(items[buttonIndex - 1].value);
            }
        );
    };

    return (
        <View style={styles.container}>
            {Platform.OS === 'android' && (
                <View
                    style={[
                        styles.wrapper,
                        {
                            backgroundColor: themeColor('secondary'),
                            opacity: disabled ? 0.8 : 1
                        }
                    ]}
                >
                    <Picker
                        selectedValue={value}
                        onValueChange={onValueChange}
                        style={{
                            color: disabled
                                ? themeColor('secondaryText')
                                : themeColor('text'),
                            width: '100%'
                        }}
                        dropdownIconColor={themeColor('text')}
                        enabled={!disabled}
                    >
                        {items.map((item, index) => (
                            <Picker.Item
                                key={`${item.value}-${index}`}
                                label={item.label}
                                value={item.value}
                            />
                        ))}
                    </Picker>
                </View>
            )}

            {Platform.OS === 'ios' && (
                <TouchableOpacity
                    onPress={showIOSPicker}
                    disabled={disabled}
                    style={[
                        styles.wrapper,
                        {
                            backgroundColor: themeColor('secondary'),
                            opacity: disabled ? 0.8 : 1
                        }
                    ]}
                >
                    <Text
                        style={{
                            color: disabled
                                ? themeColor('secondaryText')
                                : themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: 16,
                            paddingLeft: 10
                        }}
                    >
                        {displayText}
                    </Text>
                    <View style={styles.caretContainer}>
                        <CaretDown
                            stroke={themeColor('text')}
                            fill={themeColor('text')}
                        />
                    </View>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%'
    },
    wrapper: {
        height: 60,
        borderRadius: 6,
        justifyContent: 'center',
        position: 'relative',
        marginTop: 5
    },
    caretContainer: {
        position: 'absolute',
        right: 15,
        top: '50%',
        transform: [{ translateY: -7 }]
    }
});

export default DropdownInput;
