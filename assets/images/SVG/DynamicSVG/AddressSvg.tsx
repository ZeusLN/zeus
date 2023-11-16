import React from 'react';
import { Svg, Circle, Path } from 'react-native-svg';
import { themeColor } from '../../../../utils/ThemeUtils';

export default function AddressSvg({ circle = true, selected = false }) {
    const svgProps = {
        width: '50',
        height: '50',
        viewBox: circle ? '0 0 50 50' : '5 5 40 40',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg'
    };

    const circleProps = {
        cx: '25',
        cy: '25',
        r: '20',
        fill: themeColor('background')
    };

    const pathProps = {
        d: 'M29 25C29 27.209 27.209 29 25 29 22.791 29 21 27.209 21 25 21 22.791 22.791 21 25 21 27.209 21 29 22.791 29 25ZM29 25V26.5C29 27.881 30.119 29 31.5 29V29C32.881 29 34 27.881 34 26.5V25C34 20.029 29.971 16 25 16 20.029 16 16 20.029 16 25 16 29.971 20.029 34 25 34H29',
        stroke: selected ? themeColor('background') : themeColor('bolt'),
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: '2'
    };

    return React.createElement(
        Svg,
        svgProps,
        circle && React.createElement(Circle, circleProps),
        React.createElement(Path, pathProps)
    );
}
