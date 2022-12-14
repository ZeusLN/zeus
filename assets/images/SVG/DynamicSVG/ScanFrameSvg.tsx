import React from 'react';
import { Svg, Path } from 'react-native-svg';
import { themeColor } from '../../../../utils/ThemeUtils';

export default function ScanFrameSvg({ height = '316' }) {
    const svgProps = {
        width: '316',
        height,
        viewBox: '0 0 316 316',
        fill: 'none',
        stroke: themeColor('qrFrame'),
        xmlns: 'http://www.w3.org/2000/svg'
    };

    const path1Props = {
        d: 'M5 208.645V291C5 302.046 13.9543 311 25 311H107.713',
        strokeWidth: '10'
    };

    const path2Props = {
        d: 'M311 208.645V291C311 302.046 302.046 311 291 311H208.287',
        strokeWidth: '10'
    };

    const path3Props = {
        d: 'M5 107.355V25C5 13.9543 13.9543 5 25 5H107.713',
        strokeWidth: '10'
    };

    const path4Props = {
        d: 'M311 107.355V25C311 13.9543 302.046 5 291 5H208.287',
        strokeWidth: '10'
    };

    return React.createElement(
        Svg,
        svgProps,
        React.createElement(Path, path1Props),
        React.createElement(Path, path2Props),
        React.createElement(Path, path3Props),
        React.createElement(Path, path4Props)
    );
}
