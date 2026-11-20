// React Native looks a custom font up by file name on Android and by
// PostScript name on iOS. For Gloock both are 'Gloock-Regular'.
const Fonts: { [key: string]: any } = {
    headline: 'Gloock-Regular'
};

export function font(id: string): any {
    return Fonts[id];
}
