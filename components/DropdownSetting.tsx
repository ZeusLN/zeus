import * as React from 'react';
import {
    Platform,
    View,
    StyleSheet,
    Text,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';

import ModalStore from '../stores/ModalStore';
import { themeColor } from './../utils/ThemeUtils';
import CaretDown from './../assets/images/SVG/Caret Down.svg';
import { localeString } from './../utils/LocaleUtils';

interface DropdownValue {
    key: string;
    translateKey?: string;
    value: any;
    isHeader?: boolean;
}

interface DropdownSettingProps {
    title?: string;
    titleColor?: string;
    selectedValue: string | number;
    onValueChange: (value: any) => void;
    values: Array<DropdownValue>;
    disabled?: boolean;
    ModalStore?: ModalStore;
}

const getLabel = (v: DropdownValue) =>
    v.translateKey ? localeString(v.translateKey) : v.key;

@inject('ModalStore')
@observer
export default class DropdownSetting extends React.Component<
    DropdownSettingProps,
    {}
> {
    openSheet = () => {
        const { values, selectedValue, onValueChange, ModalStore } = this.props;
        const items = values.map((v) =>
            v.isHeader
                ? { label: `── ${v.key} ──`, value: null, isHeader: true }
                : {
                      label: getLabel(v),
                      value: v.value,
                      isSelected: v.value === selectedValue
                  }
        );
        ModalStore?.toggleActionSheet({ items, onSelect: onValueChange });
    };

    render() {
        const { title, titleColor, selectedValue, values, disabled } =
            this.props;

        const selectedItem = values.find(
            (v) => !v.isHeader && v.value === selectedValue
        );
        const display = selectedItem ? getLabel(selectedItem) : null;

        const titleNode = title && (
            <Text
                style={{
                    ...styles.secondaryText,
                    color: titleColor || themeColor('secondaryText')
                }}
            >
                {title}
            </Text>
        );

        return (
            <View>
                {titleNode}
                <TouchableOpacity
                    onPress={() => !disabled && this.openSheet()}
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
                        {display ?? selectedValue}
                    </Text>
                    <View style={styles.caret}>
                        <CaretDown
                            stroke={themeColor('text')}
                            fill={themeColor('text')}
                        />
                    </View>
                </TouchableOpacity>
            </View>
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
        paddingLeft: 10,
        marginTop: 10,
        marginBottom: 10,
        overflow: 'hidden',
        fontFamily: 'PPNeueMontreal-Book',
        ...Platform.select({
            ios: { paddingTop: 18 },
            android: { textAlignVertical: 'center' }
        })
    },
    caret: {
        position: 'absolute',
        right: 10
    }
});
