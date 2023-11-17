import React from 'react';
import { Svg, Circle, Polygon } from 'react-native-svg';
import { themeColor } from '../../../../utils/ThemeUtils';

export default function LightningSvg({
    width = 70,
    height = 70,
    circle = true,
    selected = false
}) {
    const svgProps = {
        width: `${width}`,
        height: `${height}`,
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

    const polygon1Props = {
        points: '20.802,29.826 23.896,36.001 25.676,32.449 24.362,29.826 25.676,27.2 23.896,23.651',
        fill: selected ? themeColor('background') : themeColor('bolt')
    };

    const polygon2Props = {
        points: '29.197,20.173 26.103,14 24.323,17.55 25.637,20.173 24.323,22.799 26.103,26.351',
        fill: selected ? themeColor('background') : themeColor('bolt')
    };

    return React.createElement(
        Svg,
        svgProps,
        circle && React.createElement(Circle, circleProps),
        React.createElement(Polygon, polygon1Props),
        React.createElement(Polygon, polygon2Props)
    );
}
