import { Animated } from 'react-native';

class InvalidInputAnimationController {
    shakeAnimation = new Animated.Value(0);
    textAnimation = new Animated.Value(0);
    private animationRef: Animated.CompositeAnimation | null = null;
    private isDisposed = false;
    private onInvalidStateChange: (isInvalid: boolean) => void;

    constructor(onInvalidStateChange: (isInvalid: boolean) => void) {
        this.onInvalidStateChange = onInvalidStateChange;
    }

    reset = () => {
        if (this.animationRef) {
            this.animationRef.stop();
            this.animationRef = null;
        }
        this.textAnimation.setValue(0);
        this.shakeAnimation.setValue(0);
    };

    clearInvalidState = () => {
        this.reset();
        if (!this.isDisposed) {
            this.onInvalidStateChange(false);
        }
    };

    start = () => {
        this.reset();
        this.onInvalidStateChange(true);

        this.animationRef = Animated.parallel([
            Animated.sequence([
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
            ]),
            Animated.sequence([
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
            ])
        ]);

        this.animationRef.start(({ finished }) => {
            this.animationRef = null;
            if (finished && !this.isDisposed) {
                this.onInvalidStateChange(false);
            }
        });
    };

    dispose = () => {
        this.isDisposed = true;
        this.reset();
    };
}

export default InvalidInputAnimationController;
