import React, { useEffect, useRef } from 'react';
import Lottie from 'lottie-react-native';
import { themeColor } from '../utils/ThemeUtils';

import { AppState, AppStateStatus } from 'react-native';

const loader = require('../assets/images/Lottie/loader.json');

interface LoadingIndicatorProps {
    size?: number;
}

function LoadingIndicator(props: LoadingIndicatorProps) {
    const { size } = props;
    const animationRef = useRef<Lottie>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            animationRef.current?.play();
        }, 100);

        const subscription = AppState.addEventListener(
            'change',
            (nextAppState: AppStateStatus) => {
                if (nextAppState === 'active') {
                    animationRef.current?.play();
                }
            }
        );

        return () => {
            clearTimeout(timer);
            subscription.remove();
        };
    }, []);

    return (
        <Lottie
            ref={animationRef}
            source={loader}
            autoPlay={false}
            loop
            colorFilters={[
                {
                    keypath: 'Comp 2',
                    color: themeColor('highlight')
                }
            ]}
            style={{
                alignSelf: 'center',
                width: size || 40,
                height: size || 40
            }}
        />
    );
}

export default LoadingIndicator;
