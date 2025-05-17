import { Platform } from 'react-native';

const Fonts: { [key: string]: any } = {
    marlide:
        Platform.OS === 'android'
            ? 'Marlide-Display'
            : 'MarlideDisplay_Regular',
    marlideBold:
        Platform.OS === 'android'
            ? 'Marlide-Display-Bold'
            : 'MarlideDisplay_Bold'
};

export function font(id: string): any {
    return Fonts[id];
}
