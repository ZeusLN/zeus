import React from 'react';
import { Svg, Circle, Polygon } from 'react-native-svg';
import { themeColor } from '../../../../utils/ThemeUtils';

export default function OnChainSvg({
    width = 70,
    height = 70,
    circle = true,
    selected = false
}) {
    const svgProps = {
        width: `${width}`,
        height: `${height}`,
        viewBox: '0 0 1589.35 2000',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg'
    };

    const circleProps = {
        cx: '794.68',
        cy: '1000',
        r: '900',
        fill: themeColor('background')
    };

    const scale = 0.34;
    const transformScale = `translate(794.68 1000) scale(${scale}) translate(-794.68 -1000)`;

    const polygonProps = [
        {
            points: '794.68 0 0 398.29 0 764.47 794.68 366.18 1589.35 764.47 1589.35 398.29 794.68 0',
            fill: selected ? themeColor('background') : themeColor('chain'),
            transform: transformScale
        },
        {
            points: '794.68 1633.82 326.88 1399.37 328.01 684.38 .39 847.95 0 1601.71 794.68 2000 1589.35 1601.71 1589.35 1235.53 794.68 1633.82',
            fill: selected ? themeColor('background') : themeColor('chain'),
            transform: transformScale
        },
        {
            points: '1224.07 665.72 794.68 880.93 399.37 682.8 399.37 1048.98 794.68 1247.11 1589.35 848.81 1224.07 665.72',
            fill: selected ? themeColor('background') : themeColor('chain'),
            transform: transformScale
        }
    ];

    return (
        <Svg {...svgProps}>
            {circle && <Circle {...circleProps} />}
            {polygonProps.map((props, index) => (
                <Polygon key={index} {...props} />
            ))}
        </Svg>
    );
}
