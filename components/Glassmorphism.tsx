import { Dimensions } from 'react-native';

import {
    BackdropBlur,
    Canvas,
    Circle,
    Group,
    rect,
    Rect,
    ImageSVG,
    useSVG
} from '@shopify/react-native-skia';
import React from 'react';

const { height, width } = Dimensions.get('window');

const clipRect = rect(0, 0, width, height);

const r = 15;

export const Glassmorphism = () => {
    const image = useSVG(
        'https://upload.wikimedia.org/wikipedia/commons/f/fd/Ghostscript_Tiger.svg'
    );
    return (
        <Canvas>
            <ImageSVG width={256} height={256} svg={image} />
            <Rect
                height={height / 2}
                width={width}
                x={0}
                y={height / 2}
                color={'red'}
            />
            <Group>
                <Circle cx={r} cy={r} r={r} color="cyan" />
                <Circle cx={50} cy={r} r={r} color="magenta" />
                <Circle cx={10} cy={100 + r} r={r} color="yellow" />
            </Group>
            <BackdropBlur intensity={20} blur={5} clip={clipRect} />
        </Canvas>
    );
};
