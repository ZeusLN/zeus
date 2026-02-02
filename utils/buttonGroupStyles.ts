import { themeColor } from './ThemeUtils';

export const getButtonGroupStyles = () => ({
    selectedButtonStyle: {
        backgroundColor: themeColor('highlight'),
        borderRadius: 12
    },
    containerStyle: {
        backgroundColor: themeColor('secondary'),
        borderRadius: 12,
        borderColor: themeColor('secondary'),
        marginBottom: 10
    },
    innerBorderStyle: {
        color: themeColor('secondary')
    }
});

export const buttonTextStyle = {
    fontFamily: 'PPNeueMontreal-Book'
};
