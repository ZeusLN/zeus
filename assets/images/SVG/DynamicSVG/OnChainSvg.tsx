import React from 'react';
import { Svg, Circle, Path } from 'react-native-svg';
import { themeColor } from '../../../../utils/ThemeUtils';

export default function OnChainSvg({ width = 70, height = 70 }) {
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
        fill: '#242930'
    };

    const path1Props = {
        d: 'M28.717,27.892l-1.65-1.652l4.129-4.131l-3.304-3.304l-4.13,4.13l-1.653-1.651l5.783-5.783l6.608,6.608L28.717,27.892z',
        fill: themeColor('chain')
    };

    const path2Props = {
        d: 'M21.282,22.108l1.652,1.653l-4.13,4.13l3.304,3.304l4.131-4.129l1.652,1.65L22.108,34.5L15.5,27.892L21.282,22.108z',
        fill: themeColor('chain')
    };

    const path3Props = {
        d: 'M29.544,22.108l-1.652-1.651l-7.435,7.435l1.651,1.652L29.544,22.108z',
        fill: themeColor('chain')
    };

    return React.createElement(
        Svg,
        svgProps,
        React.createElement(Circle, circleProps),
        React.createElement(Path, path1Props),
        React.createElement(Path, path2Props),
        React.createElement(Path, path3Props)
    );
}
