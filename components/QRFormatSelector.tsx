import * as React from 'react';
import { Text, StyleSheet } from 'react-native';
import { ButtonGroup } from '@rneui/themed';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import { getButtonGroupStyles } from '../utils/buttonGroupStyles';

interface QRFormatSelectorProps {
    selectedIndex: number;
    onSelect: (index: number) => void;
    hideSingleFrame?: boolean;
}

const QRFormatSelector: React.FC<QRFormatSelectorProps> = ({
    selectedIndex,
    onSelect,
    hideSingleFrame = false
}) => {
    const singleButton = () => (
        <Text
            style={{
                ...styles.text,
                color:
                    selectedIndex === 0
                        ? themeColor('background')
                        : themeColor('text')
            }}
        >
            {localeString('views.PSBT.singleFrame')}
        </Text>
    );

    const bcurButton = () => {
        const bcurIndex = hideSingleFrame ? 0 : 1;
        return (
            <Text
                style={{
                    ...styles.text,
                    color:
                        selectedIndex === bcurIndex
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                BC-ur
            </Text>
        );
    };

    const bbqrButton = () => {
        const bbqrIndex = hideSingleFrame ? 1 : 2;
        return (
            <Text
                style={{
                    ...styles.text,
                    color:
                        selectedIndex === bbqrIndex
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                BBQr
            </Text>
        );
    };

    const buttons: any[] = [
        !hideSingleFrame && { element: singleButton },
        { element: bcurButton },
        { element: bbqrButton }
    ].filter(Boolean);

    const groupStyles = getButtonGroupStyles();

    return (
        <ButtonGroup
            onPress={onSelect}
            selectedIndex={selectedIndex}
            buttons={buttons}
            selectedButtonStyle={groupStyles.selectedButtonStyle}
            containerStyle={groupStyles.containerStyle}
            innerBorderStyle={groupStyles.innerBorderStyle}
        />
    );
};

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    }
});

export default QRFormatSelector;
