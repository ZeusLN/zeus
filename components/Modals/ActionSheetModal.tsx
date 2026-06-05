import React from 'react';
import {
    Easing,
    Platform,
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ScrollView
} from 'react-native';
import { inject, observer } from 'mobx-react';

import ModalBox from '../ModalBox';
import ModalStore from '../../stores/ModalStore';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

export interface ActionSheetItem {
    label: string;
    value: any;
    isHeader?: boolean;
    isSelected?: boolean;
}

interface ActionSheetModalProps {
    ModalStore?: ModalStore;
}

@inject('ModalStore')
@observer
export default class ActionSheetModal extends React.Component<
    ActionSheetModalProps,
    {}
> {
    render() {
        const { ModalStore } = this.props;
        const { showActionSheet, actionSheetItems, actionSheetOnSelect } =
            ModalStore!;

        const close = () => ModalStore?.toggleActionSheet();

        const list = (
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                {actionSheetItems.map((item: ActionSheetItem, i) => (
                    <TouchableOpacity
                        key={`${item.label}-${i}`}
                        disabled={item.isHeader}
                        onPress={() => {
                            if (!item.isHeader)
                                actionSheetOnSelect?.(item.value);
                            close();
                        }}
                        style={[
                            styles.row,
                            Platform.OS === 'android' && {
                                alignItems: 'flex-start'
                            },
                            i !== actionSheetItems.length - 1 && {
                                borderBottomWidth: StyleSheet.hairlineWidth,
                                borderBottomColor: themeColor('separator')
                            }
                        ]}
                    >
                        <Text
                            style={{
                                ...styles.rowText,
                                color: item.isHeader
                                    ? themeColor('secondaryText')
                                    : themeColor('text'),
                                fontFamily: item.isSelected
                                    ? 'PPNeueMontreal-Medium'
                                    : 'PPNeueMontreal-Book'
                            }}
                        >
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        );

        if (Platform.OS === 'android') {
            return (
                <ModalBox
                    isOpen={showActionSheet}
                    onClosed={() => ModalStore?.clearActionSheet()}
                    entry="center"
                    swipeToClose={false}
                    backdropPressToClose={true}
                    backdropOpacity={0.4}
                    animationDuration={250}
                    easing={Easing.out(Easing.cubic)}
                    style={{ backgroundColor: 'transparent' }}
                >
                    <TouchableWithoutFeedback onPress={close}>
                        <View style={styles.centered}>
                            <TouchableWithoutFeedback onPress={() => {}}>
                                <View
                                    style={{
                                        ...styles.dialog,
                                        backgroundColor:
                                            themeColor('modalBackground')
                                    }}
                                >
                                    {list}
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </ModalBox>
            );
        }

        return (
            <ModalBox
                isOpen={showActionSheet}
                onClosed={() => ModalStore?.clearActionSheet()}
                position="bottom"
                swipeToClose={true}
                backdropPressToClose={true}
                backdropOpacity={0.4}
                animationDuration={250}
                easing={Easing.out(Easing.cubic)}
                style={{
                    backgroundColor: 'transparent',
                    height: 'auto'
                }}
            >
                <View style={styles.container}>
                    <View
                        style={{
                            ...styles.group,
                            backgroundColor: themeColor('modalBackground')
                        }}
                    >
                        {list}
                    </View>
                    <TouchableOpacity
                        onPress={close}
                        style={{
                            ...styles.cancel,
                            backgroundColor: themeColor('modalBackground')
                        }}
                    >
                        <Text
                            style={{
                                ...styles.cancelText,
                                color: themeColor('text')
                            }}
                        >
                            {localeString('general.cancel')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ModalBox>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 8,
        paddingBottom: 34
    },
    group: {
        borderRadius: 14,
        overflow: 'hidden',
        maxHeight: 400
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24
    },
    dialog: {
        width: '100%',
        maxHeight: '70%',
        overflow: 'hidden'
    },
    row: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center'
    },
    rowText: {
        fontSize: 18
    },
    cancel: {
        marginTop: 8,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center'
    },
    cancelText: {
        fontSize: 18,
        fontFamily: 'PPNeueMontreal-Bold'
    }
});
