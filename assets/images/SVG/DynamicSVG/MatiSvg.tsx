import React from 'react';
import { Svg, Circle, Path } from 'react-native-svg';
import { themeColor } from '../../../../utils/ThemeUtils';

export default function MatiSvg({ width = 70, height = 70 }) {
    const svgProps = {
        width: `${width}`,
        height: `${height}`,
        viewBox: '0 0 50 50',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg'
    };

    const circleProps = {
        cx: '25',
        cy: '25',
        r: '20',
        fill: themeColor('background')
    };

    const path1Props = {
        d: 'M34.45 28.3045l-9.4486 4.6305L15.55 28.3045l4.1137 -2.0184c1.0616 1.8058 3.055 3.0196 5.3348 3.0196s4.2732 -1.2137 5.3348 -3.0196zM24.9986 17.065L15.55 21.6955l4.1137 2.0184c1.0616 -1.8058 3.0535 -3.0196 5.3348 -3.0196c2.2828 0 4.2732 1.2137 5.3348 3.0196L34.45 21.6955zM24.9986 23.0067c-1.1252 0 -2.0391 0.8933 -2.0391 1.9933s0.914 1.9948 2.0391 1.9948S27.0376 26.1001 27.0376 25s-0.914 -1.9933 -2.0391 -1.9933zM24.9986 23.0067',
        fill: themeColor('chain')
    };

    return React.createElement(
        Svg,
        svgProps,
        React.createElement(Circle, circleProps),
        React.createElement(Path, path1Props)
    );
}
