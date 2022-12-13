import React from 'react';
import { Svg, Circle, Path } from 'react-native-svg';
import { themeColor } from '../../../../utils/ThemeUtils';

export default function OnChainSvg() {
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

    const path1Props = {
        d: 'M22.9434 25.9336C23.3728 26.5077 23.9207 26.9827 24.5499 27.3265C25.1791 27.6703 25.8749 27.8747 26.59 27.9259C27.3052 27.9771 28.0229 27.8739 28.6947 27.6233C29.3665 27.3728 29.9765 26.9806 30.4834 26.4736L33.4834 23.4736C34.3942 22.5305 34.8981 21.2675 34.8867 19.9566C34.8753 18.6456 34.3495 17.3915 33.4225 16.4645C32.4954 15.5374 31.2413 15.0116 29.9304 15.0002C28.6194 14.9888 27.3564 15.4928 26.4134 16.4036L24.6934 18.1136',
        stroke: themeColor('chain'),
        strokeWidth: '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
    };

    const path2Props = {
        d: 'M26.9436 23.9336C26.5141 23.3594 25.9662 22.8844 25.337 22.5406C24.7078 22.1969 24.0121 21.9925 23.2969 21.9412C22.5818 21.89 21.864 21.9932 21.1922 22.2438C20.5205 22.4944 19.9104 22.8865 19.4036 23.3936L16.4036 26.3936C15.4928 27.3366 14.9888 28.5996 15.0002 29.9106C15.0116 31.2216 15.5374 32.4756 16.4645 33.4027C17.3915 34.3297 18.6456 34.8556 19.9566 34.8669C21.2675 34.8783 22.5305 34.3744 23.4736 33.4636L25.1836 31.7536',
        stroke: themeColor('chain'),
        strokeWidth: '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
    };

    return React.createElement(
        Svg,
        svgProps,
        React.createElement(Circle, circleProps),
        React.createElement(Path, path1Props),
        React.createElement(Path, path2Props)
    );
}
