import { Animated } from 'react-native';

class InvalidInputAnimationController {
    shakeAnimation = new Animated.Value(0);
    textAnimation = new Animated.Value(0);
    private textAnimationRef: Animated.CompositeAnimation | null = null;
    private shakeAnimationRef: Animated.CompositeAnimation | null = null;
    private isDisposed = false;
    private onInvalidStateChange: (isInvalid: boolean) => void;

    constructor(onInvalidStateChange: (isInvalid: boolean) => void) {
        this.onInvalidStateChange = onInvalidStateChange;
    }

    reset = () => {
        this.resetTextAnimation();
        this.resetShakeAnimation();
    };

    resetTextAnimation = () => {
        if (this.textAnimationRef) {
            this.textAnimationRef.stop();
            this.textAnimationRef = null;
        }
        this.textAnimation.setValue(0);
    };

    resetShakeAnimation = () => {
        if (this.shakeAnimationRef) {
            this.shakeAnimationRef.stop();
            this.shakeAnimationRef = null;
        }
        this.shakeAnimation.setValue(0);
    };

    clearInvalidState = () => {
        this.resetTextAnimation();
        if (!this.isDisposed) {
            this.onInvalidStateChange(false);
        }
    };

    private stopShakeAnimation = () => {
        if (this.shakeAnimationRef) {
            this.shakeAnimationRef.stop();
            this.shakeAnimationRef = null;
        }
    };

    start = () => {
        this.resetTextAnimation();
        this.stopShakeAnimation();
        this.onInvalidStateChange(true);

        this.textAnimationRef = Animated.sequence([
            Animated.timing(this.textAnimation, {
                toValue: 1,
                duration: 100,
                useNativeDriver: false
            }),
            Animated.timing(this.textAnimation, {
                toValue: 0,
                duration: 1000,
                useNativeDriver: false
            })
        ]);

        this.shakeAnimationRef = Animated.sequence([
            Animated.timing(this.shakeAnimation, {
                toValue: 10,
                duration: 100,
                useNativeDriver: true
            }),
            Animated.timing(this.shakeAnimation, {
                toValue: -10,
                duration: 100,
                useNativeDriver: true
            }),
            Animated.timing(this.shakeAnimation, {
                toValue: 10,
                duration: 100,
                useNativeDriver: true
            }),
            Animated.timing(this.shakeAnimation, {
                toValue: 0,
                duration: 100,
                useNativeDriver: true
            })
        ]);

        this.textAnimationRef.start(({ finished }) => {
            this.textAnimationRef = null;
            if (finished && !this.isDisposed) {
                this.onInvalidStateChange(false);
            }
        });

        this.shakeAnimationRef.start(() => {
            this.shakeAnimationRef = null;
        });
    };

    dispose = () => {
        this.isDisposed = true;
        this.reset();
    };
}

export default InvalidInputAnimationController;
