import React from 'react';
import { Svg, Circle, Path } from 'react-native-svg';
import { themeColor } from '../../../../utils/ThemeUtils';

export default function LightningSvg() {
    const svgProps = {
        width: '50',
        height: '50',
        viewBox: '0 0 50 50',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg'
    };

    const circleProps = {
        cx: '25',
        cy: '25',
        r: '20',
        fill: '#242930'
    };

    const pathProps = {
        d: 'M16.6992 26.7087C16.6992 26.7087 18.4423 19 22.1217 14.0685L34.6992 13.5391C34.6992 13.5391 28.5722 19.2803 26.7978 22.395L34.1356 21.8499C34.1356 21.8499 22.5548 30.1192 18.6615 38.5391C18.6615 38.5391 17.8161 31.609 21.7876 26.1792L16.6992 26.7087Z',
        fill: themeColor('bolt')
    };

    return React.createElement(
        Svg,
        svgProps,
        React.createElement(Circle, circleProps),
        React.createElement(Path, pathProps)
    );
}
