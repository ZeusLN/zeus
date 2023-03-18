import * as React from 'react';
import { ActionSheetIOS, Platform, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';

import Button from '../../components/Button';
import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

interface SortButtonProps {
    onValueChange: (value: any) => void;
    values: Array<any>;
}

export default class SortButton extends React.Component<SortButtonProps, {}> {
    render() {
        const { onValueChange, values } = this.props;

        // TODO for some reason it will not responsd to item 0 so a cancel item
        // is placed here
        const pickerValuesAndroid: Array<any> = [
            <Picker.Item
                key={'cancel'}
                label={localeString('general.cancel')}
            />
        ];
        const pickerValuesIOS: Array<string> = [localeString('general.cancel')];
        values.forEach((value: { key: string; value: any }) => {
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
                {Platform.OS === 'android' && (
                    <View
                        style={{
                            height: 50,
                            overflow: 'hidden',
                            borderRadius: 16
                        }}
                    >
                        <Picker
                            onValueChange={(itemValue: any) =>
                                onValueChange(itemValue)
                            }
                            style={{
                                marginTop: -2,
                                width: 48,
                                color: themeColor('text'),
                                backgroundColor: themeColor('secondary')
                            }}
                            dropdownIconColor={themeColor('text')}
                        >
                            {pickerValuesAndroid}
                        </Picker>
                    </View>
                )}

                {Platform.OS === 'ios' && (
                    <View>
                        <Button
                            title=""
                            icon={{
                                name: 'sort',
                                size: 25
                            }}
                            adaptiveWidth
                            buttonStyle={{ width: 50 }}
                            quinary
                            onPress={() =>
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
                        />
                    </View>
                )}
            </React.Fragment>
        );
    }
}
