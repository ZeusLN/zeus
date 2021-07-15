import * as React from 'react';
import {
    ActionSheetIOS,
    Platform,
    View,
    Text,
    TouchableOpacity
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { themeColor } from './../utils/ThemeUtils';

interface DropdownSettingProps {
    title: string;
    selectedValue: string | boolean;
    displayValue?: string;
    onValueChange: (value: any) => void;
    values: Array<any>;
}

export default class DropdownSetting extends React.Component<
    DropdownSettingProps,
    {}
> {
    render() {
        const {
            title,
            selectedValue,
            displayValue,
            onValueChange,
            values
        } = this.props;

        const pickerValuesAndroid: Array<any> = [];
        const pickerValuesIOS: Array<string> = ['Cancel'];
        values.forEach((value: { key: string; value: string }) => {
            pickerValuesAndroid.push(
                <Picker.Item
                    key={value.key}
                    label={value.key}
                    value={value.value}
                />
            );
            pickerValuesIOS.push(value.key);
        });

        return (
            <React.Fragment>
                {Platform.OS !== 'ios' && (
                    <View>
                        <Text
                            style={{
                                color: themeColor('text'),
                                paddingLeft: 10
                            }}
                        >
                            {title}
                        </Text>
                        <Picker
                            selectedValue={selectedValue}
                            onValueChange={(itemValue: string) =>
                                onValueChange(itemValue)
                            }
                            style={{
                                height: 50,
                                color: themeColor('text')
                            }}
                        >
                            {pickerValuesAndroid}
                        </Picker>
                    </View>
                )}

                {Platform.OS === 'ios' && (
                    <View>
                        <Text
                            style={{
                                color: themeColor('text'),
                                textDecorationLine: 'underline',
                                paddingLeft: 10,
                                paddingTop: 10
                            }}
                        >
                            {title}
                        </Text>
                        <TouchableOpacity
                            onPress={() =>
                                ActionSheetIOS.showActionSheetWithOptions(
                                    {
                                        options: pickerValuesIOS,
                                        cancelButtonIndex: 0
                                    },
                                    buttonIndex => {
                                        if (buttonIndex) {
                                            onValueChange(
                                                values[buttonIndex - 1].value
                                            );
                                        }
                                    }
                                )
                            }
                        >
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    paddingLeft: 10
                                }}
                            >
                                {displayValue ? displayValue : selectedValue}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </React.Fragment>
        );
    }
}
