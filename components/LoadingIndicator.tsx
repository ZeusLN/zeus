import * as React from 'react';
import { Image } from 'react-native';

import Loading from './../assets/images/GIF/Loading.gif';

interface LoadingIndicatorProps {
    size?: number;
}

function LoadingIndicator(props: LoadingIndicatorProps) {
    const { size } = props;

    return (
        <Image
            source={Loading}
            style={{
                alignSelf: 'center',
                width: size || 100,
                height: size || 100
            }}
        />
    );
}

export default LoadingIndicator;
