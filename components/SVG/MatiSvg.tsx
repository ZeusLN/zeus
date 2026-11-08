import React from 'react';
import { Svg, Circle, Defs, Line, Mask, Path, Rect } from 'react-native-svg';
import { themeColor } from '../../utils/ThemeUtils';

interface MatiSvgProps {
    width?: number;
    height?: number;
    circle?: boolean;
    // crosses out the eye, for "hidden" states such as lurker mode
    off?: boolean;
    color?: string;
}

// Diagonal through the eye; the eye itself spans 15.55-34.45 by 17.065-32.935
const SLASH = { x1: '17', y1: '17', x2: '33', y2: '33' };

export default function MatiSvg({
    width = 70,
    height = 70,
    circle = true,
    off = false,
    color
}: MatiSvgProps) {
    const svgProps = {
        width: `${width}`,
        height: `${height}`,
        viewBox: circle ? '0 0 50 50' : '14 14 22 22',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg'
    };

    const circleProps = {
        cx: '25',
        cy: '25',
        r: '20',
        fill: themeColor('background')
    };

    const fill = color || themeColor('chain');

    const path1Props = {
        d: 'M34.45 28.3045l-9.4486 4.6305L15.55 28.3045l4.1137 -2.0184c1.0616 1.8058 3.055 3.0196 5.3348 3.0196s4.2732 -1.2137 5.3348 -3.0196zM24.9986 17.065L15.55 21.6955l4.1137 2.0184c1.0616 -1.8058 3.0535 -3.0196 5.3348 -3.0196c2.2828 0 4.2732 1.2137 5.3348 3.0196L34.45 21.6955zM24.9986 23.0067c-1.1252 0 -2.0391 0.8933 -2.0391 1.9933s0.914 1.9948 2.0391 1.9948S27.0376 26.1001 27.0376 25s-0.914 -1.9933 -2.0391 -1.9933zM24.9986 23.0067',
        fill,
        // cut a gap around the slash so it reads against the eye
        ...(off && { mask: 'url(#matiSlashGap)' })
    };

    return React.createElement(
        Svg,
        svgProps,
        circle && React.createElement(Circle, circleProps),
        off &&
            React.createElement(
                Defs,
                null,
                React.createElement(
                    Mask,
                    {
                        id: 'matiSlashGap',
                        maskUnits: 'userSpaceOnUse',
                        x: '0',
                        y: '0',
                        width: '50',
                        height: '50'
                    },
                    React.createElement(Rect, {
                        width: '50',
                        height: '50',
                        fill: 'white'
                    }),
                    React.createElement(Line, {
                        ...SLASH,
                        stroke: 'black',
                        strokeWidth: '3.4',
                        strokeLinecap: 'round'
                    })
                )
            ),
        React.createElement(Path, path1Props),
        off &&
            React.createElement(Line, {
                ...SLASH,
                stroke: fill,
                strokeWidth: '1.4',
                strokeLinecap: 'round'
            })
    );
}
