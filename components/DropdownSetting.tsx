import * as React from 'react';
import {
    ActionSheetIOS,
    Platform,
    View,
    StyleSheet,
    Text,
    TouchableOpacity
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { themeColor } from './../utils/ThemeUtils';
import CaretDown from './../assets/images/SVG/Caret Down.svg';
import { localeString } from './../utils/LocaleUtils';

interface DropdownSettingProps {
    title?: string;
    titleColor?: string;
    selectedValue: string | number;
    onValueChange: (value: any) => void;
    values: Array<any>;
    disabled?: boolean;
}

export default class DropdownSetting extends React.Component<
    DropdownSettingProps,
    {}
> {
    render() {
        const {
            title,
            titleColor,
            selectedValue,
            onValueChange,
            values,
            disabled
        } = this.props;

        const pickerValuesAndroid: Array<any> = [];
        const pickerValuesIOS: Array<string> = ['Cancel'];
        values.forEach(
            (value: { key: string; translateKey: string; value: string }) => {
                const translatedKey = value.translateKey
                    ? localeString(value.translateKey)
                    : undefined;
                pickerValuesAndroid.push(
                    <Picker.Item
                        key={value.key}
                        label={translatedKey ?? value.key}
                        value={value.value}
                    />
                );
                pickerValuesIOS.push(value.key);
            }
        );

        const displayItem = values.find(
            (value: any) => value.value === selectedValue
        );

        const display = displayItem ? displayItem.key : null;

        return (
            <React.Fragment>
                {Platform.OS === 'android' && (
                    <View>
                        {title && (
                            <Text
                                style={{
                                    ...styles.secondaryText,
                                    color:
                                        titleColor ||
                                        themeColor('secondaryText')
                                }}
                            >
                                {title}
                            </Text>
                        )}
                        <Picker
                            selectedValue={selectedValue}
                            onValueChange={(itemValue: string | number) =>
                                onValueChange(itemValue)
                            }
                            style={{
                                color: themeColor('text'),
                                backgroundColor: themeColor('secondary'),
                                ...styles.field,
                                opacity: disabled ? 0.25 : 1
                            }}
                            dropdownIconColor={themeColor('text')}
                            enabled={!disabled}
                        >
                            {pickerValuesAndroid}
                        </Picker>
                    </View>
                )}

                {Platform.OS === 'ios' && (
                    <View>
                        {title && (
                            <Text
                                style={{
                                    ...styles.secondaryText,
                                    color:
                                        titleColor ||
                                        themeColor('secondaryText')
                                }}
                            >
                                {title}
                            </Text>
                        )}
                        <TouchableOpacity
                            onPress={() =>
                                !disabled &&
                                ActionSheetIOS.showActionSheetWithOptions(
                                    {
                                        options: pickerValuesIOS,
                                        cancelButtonIndex: 0
                                    },
                                    (buttonIndex) => {
                                        if (buttonIndex) {
                                            onValueChange(
                                                values[buttonIndex - 1].value
                                            );
                                        }
                                    }
                                )
                            }
                            style={{
                                opacity: disabled ? 0.25 : 1,
                                justifyContent: 'center'
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    backgroundColor: themeColor('secondary'),
                                    ...styles.field
                                }}
                            >
                                {display ? display : selectedValue}
                            </Text>
                            <View
                                style={{
                                    position: 'absolute',
                                    right: 10
                                }}
                            >
                                <CaretDown
                                    stroke={themeColor('text')}
                                    fill={themeColor('text')}
                                />
                            </View>
                        </TouchableOpacity>
                    </View>
                )}
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
    secondaryText: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    field: {
        fontSize: 20,
        height: 60,
        width: '100%',
        borderRadius: 6,
        borderBottomWidth: 20,
        paddingLeft: 10,
        marginTop: 10,
        marginBottom: 10,
        overflow: 'hidden',
        fontFamily: 'PPNeueMontreal-Book',
        ...Platform.select({ ios: { paddingTop: 18 }, android: {} })
    }
});
