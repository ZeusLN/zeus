// based on react-native-modalbox
// https://github.com/maxs15/react-native-modalbox/blob/master/index.js

import React from 'react';
import PropTypes from 'prop-types';
import {
    View,
    StyleSheet,
    PanResponder,
    Animated,
    TouchableWithoutFeedback,
    Dimensions,
    Easing,
    BackHandler,
    Platform,
    Modal,
    Keyboard,
    ViewStyle,
    StyleProp,
    LayoutChangeEvent
} from 'react-native';
import { inject, observer } from 'mobx-react';

import SettingsStore from '../stores/SettingsStore';

const {
    height: SCREEN_HEIGHT,
    width: SCREEN_WIDTH,
    fontScale: FONT_SCALE
} = Dimensions.get('window');

const styles = StyleSheet.create({
    wrapper: {
        backgroundColor: 'white'
    },
    transparent: {
        zIndex: 2,
        backgroundColor: 'rgba(0,0,0,0)'
    },
    absolute: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
    }
});

interface ModalBoxProps {
    isOpen?: boolean;
    isDisabled?: boolean;
    startOpen: boolean;
    backdropPressToClose?: boolean;
    swipeToClose?: boolean;
    swipeThreshold?: number;
    swipeArea?: number;
    position?: string;
    entry?: string;
    backdrop?: boolean;
    backdropOpacity?: number;
    backdropColor?: string;
    backdropContent?: React.ReactNode;
    animationDuration?: number;
    backButtonClose?: boolean;
    easing?: (value: number) => number;
    coverScreen?: boolean;
    keyboardTopOffset?: number;
    onClosed?: () => void;
    onOpened?: () => void;
    onClosingState?: (state: boolean) => void;
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
    useNativeDriver?: boolean;
    onLayout?: (event: LayoutChangeEvent) => void;
    SettingsStore?: SettingsStore;
}

interface ModalBoxState {
    position: Animated.Value;
    backdropOpacity: Animated.Value;
    isOpen: boolean;
    isAnimateClose: boolean;
    isAnimateOpen: boolean;
    swipeToClose: boolean;
    height: number;
    width: number;
    containerHeight: number;
    containerWidth: number;
    isInitialized: boolean;
    keyboardOffset: number;
    pan: any;
    isAnimateBackdrop: boolean;
    animBackdrop?: Animated.CompositeAnimation;
    animOpen?: Animated.CompositeAnimation;
    animClose?: Animated.CompositeAnimation;
    positionDest?: number;
}

@inject('SettingsStore')
@observer
export default class ModalBox extends React.PureComponent<
    ModalBoxProps,
    ModalBoxState
> {
    static propTypes = {
        isOpen: PropTypes.bool,
        isDisabled: PropTypes.bool,
        startOpen: PropTypes.bool,
        backdropPressToClose: PropTypes.bool,
        swipeToClose: PropTypes.bool,
        swipeThreshold: PropTypes.number,
        swipeArea: PropTypes.number,
        position: PropTypes.string,
        entry: PropTypes.string,
        backdrop: PropTypes.bool,
        backdropOpacity: PropTypes.number,
        backdropColor: PropTypes.string,
        backdropContent: PropTypes.element,
        animationDuration: PropTypes.number,
        backButtonClose: PropTypes.bool,
        easing: PropTypes.func,
        coverScreen: PropTypes.bool,
        keyboardTopOffset: PropTypes.number,
        onClosed: PropTypes.func,
        onOpened: PropTypes.func,
        onClosingState: PropTypes.func,
        children: PropTypes.node
    };

    static defaultProps = {
        startOpen: false,
        backdropPressToClose: true,
        swipeToClose: true,
        swipeThreshold: 50,
        position: 'center',
        backdrop: true,
        backdropOpacity: 0.5,
        backdropColor: 'black',
        backdropContent: null,
        animationDuration: 400,
        backButtonClose: false,
        easing: Easing.elastic(0.8),
        coverScreen: false,
        keyboardTopOffset: Platform.OS == 'ios' ? 22 : 0,
        useNativeDriver: true
    };

    subscriptions: any[] = [];
    backHandlerSubscription: { remove: () => void } | null = null;
    onViewLayoutCalculated: (() => void) | null; // Can be either a function or null

    constructor(props: ModalBoxProps) {
        super(props);

        this.onBackPress = this.onBackPress.bind(this);
        this.handleOpenning = this.handleOpenning.bind(this);
        this.onKeyboardHide = this.onKeyboardHide.bind(this);
        this.onKeyboardChange = this.onKeyboardChange.bind(this);
        this.animateBackdropOpen = this.animateBackdropOpen.bind(this);
        this.animateBackdropClose = this.animateBackdropClose.bind(this);
        this.stopAnimateOpen = this.stopAnimateOpen.bind(this);
        this.animateOpen = this.animateOpen.bind(this);
        this.stopAnimateClose = this.stopAnimateClose.bind(this);
        this.animateClose = this.animateClose.bind(this);
        this.calculateModalPosition = this.calculateModalPosition.bind(this);
        this.createPanResponder = this.createPanResponder.bind(this);
        this.onViewLayout = this.onViewLayout.bind(this);
        this.onContainerLayout = this.onContainerLayout.bind(this);
        this.renderBackdrop = this.renderBackdrop.bind(this);
        this.renderContent = this.renderContent.bind(this);
        this.open = this.open.bind(this);
        this.close = this.close.bind(this);

        const position = props.startOpen
            ? new Animated.Value(0)
            : new Animated.Value(
                  props.entry === 'top' ? -SCREEN_HEIGHT : SCREEN_HEIGHT
              );
        this.state = {
            position,
            backdropOpacity: new Animated.Value(0),
            isOpen: props.startOpen || false,
            isAnimateClose: false,
            isAnimateOpen: false,
            swipeToClose: false,
            height: SCREEN_HEIGHT,
            width: SCREEN_WIDTH,
            containerHeight: SCREEN_HEIGHT,
            containerWidth: SCREEN_WIDTH,
            isInitialized: false,
            keyboardOffset: 0,
            pan: this.createPanResponder(position),
            isAnimateBackdrop: false,
            animBackdrop: undefined,
            animOpen: undefined,
            animClose: undefined,
            positionDest: undefined
        };

        // Needed for iOS because the keyboard covers the screen
        if (Platform.OS === 'ios') {
            this.subscriptions = [
                Keyboard.addListener(
                    'keyboardWillChangeFrame',
                    this.onKeyboardChange
                ),
                Keyboard.addListener('keyboardDidHide', this.onKeyboardHide)
            ];
        }
    }

    componentDidMount() {
        this.handleOpenning();
    }

    componentDidUpdate(prevProps: any) {
        if (this.props.isOpen != prevProps.isOpen) {
            this.handleOpenning();
        }
    }

    componentWillUnmount() {
        if (this.subscriptions)
            this.subscriptions.forEach((sub) => sub.remove());
        if (this.backHandlerSubscription) {
            this.backHandlerSubscription.remove();
            this.backHandlerSubscription = null;
        }
    }

    onBackPress() {
        this.close();
        return true;
    }

    handleOpenning() {
        if (typeof this.props.isOpen == 'undefined') return;
        if (this.props.isOpen) this.open();
        else this.close();
    }

    /****************** ANIMATIONS **********************/

    /*
     * The keyboard is hidden (IOS only)
     */
    onKeyboardHide() {
        this.setState({ keyboardOffset: 0 });
    }

    /*
     * The keyboard frame changed, used to detect when the keyboard open, faster than keyboardDidShow (IOS only)
     */
    onKeyboardChange(evt: any) {
        if (!evt) return;
        if (!this.state.isOpen) return;
        const keyboardFrame = evt.endCoordinates;
        const keyboardHeight =
            this.state.containerHeight - keyboardFrame.screenY;

        this.setState({ keyboardOffset: keyboardHeight }, () => {
            this.animateOpen();
        });
    }

    /*
     * Open animation for the backdrop, will fade in
     */
    animateBackdropOpen() {
        if (this.state.isAnimateBackdrop && this.state.animBackdrop) {
            this.state.animBackdrop.stop();
        }
        this.setState({ isAnimateBackdrop: true });

        const animBackdrop = Animated.timing(this.state.backdropOpacity, {
            toValue: 1,
            duration: this.props.animationDuration,
            easing: this.props.easing,
            useNativeDriver: this.props.useNativeDriver ?? true
        });

        this.setState({ animBackdrop });

        animBackdrop.start(() => {
            this.setState({
                isAnimateBackdrop: false
            });
        });
    }

    animateBackdropClose() {
        if (this.state.isAnimateBackdrop && this.state.animBackdrop) {
            this.state.animBackdrop.stop();
        }
        this.setState({ isAnimateBackdrop: true });

        const animBackdrop = Animated.timing(this.state.backdropOpacity, {
            toValue: 0,
            duration: this.props.animationDuration,
            easing: this.props.easing,
            useNativeDriver: this.props.useNativeDriver ?? true
        });

        this.setState({ animBackdrop });

        animBackdrop.start(() => {
            this.setState({
                isAnimateBackdrop: false
            });
        });
    }

    /*
     * Stop opening animation
     */
    stopAnimateOpen() {
        if (this.state.isAnimateOpen) {
            if (this.state.animOpen) this.state.animOpen.stop();
            this.setState({ isAnimateOpen: false });
        }
    }

    /*
     * Open animation for the modal, will move up
     */
    animateOpen() {
        this.stopAnimateClose();

        // Backdrop fadeIn
        if (this.props.backdrop) this.animateBackdropOpen();

        this.setState(
            {
                isAnimateOpen: true,
                isOpen: true
            },
            () => {
                requestAnimationFrame(() => {
                    // Detecting modal position
                    let positionDest = this.calculateModalPosition(
                        this.state.containerHeight - this.state.keyboardOffset
                    );
                    if (
                        this.state.keyboardOffset &&
                        positionDest !== undefined &&
                        positionDest < (this.props.keyboardTopOffset ?? 0)
                    ) {
                        positionDest = this.props.keyboardTopOffset ?? 0;
                    }

                    // Fallback for undefined positionDest
                    positionDest = positionDest ?? 0;

                    if (this.props.entry === 'center') {
                        this.state.position.setValue(positionDest);
                        const animOpen = Animated.timing(this.state.position, {
                            toValue: positionDest,
                            duration: 0,
                            useNativeDriver: this.props.useNativeDriver ?? true
                        });
                        this.setState({ animOpen, positionDest });
                        animOpen.start(() => {
                            this.setState({ isAnimateOpen: false });
                            if (this.props.onOpened) this.props.onOpened();
                        });
                    } else {
                        const animOpen = Animated.timing(this.state.position, {
                            toValue: positionDest,
                            duration: this.props.animationDuration,
                            easing: this.props.easing,
                            useNativeDriver: this.props.useNativeDriver ?? true
                        });

                        this.setState({ animOpen });

                        animOpen.start(() => {
                            this.setState({
                                isAnimateOpen: false,
                                animOpen,
                                positionDest
                            });

                            if (this.props.onOpened) {
                                this.props.onOpened();
                            }
                        });
                    }
                });
            }
        );
    }

    /*
     * Stop closing animation
     */
    stopAnimateClose() {
        if (this.state.isAnimateClose) {
            if (this.state.animClose) this.state.animClose.stop();
            this.setState({ isAnimateClose: false });
        }
    }

    /*
     * Close animation for the modal, will move down
     */
    animateClose() {
        this.stopAnimateOpen();

        // Backdrop fadeout
        if (this.props.backdrop) this.animateBackdropClose();

        this.setState(
            {
                isAnimateClose: true,
                isOpen: false
            },
            () => {
                if (this.props.entry === 'center') {
                    const animClose = Animated.timing(this.state.position, {
                        toValue: this.state.positionDest || 0,
                        duration: 0,
                        useNativeDriver: this.props.useNativeDriver ?? true
                    });
                    animClose.start(() => {
                        this.setState({ isAnimateClose: false, animClose });
                        if (this.props.onClosed) this.props.onClosed();
                    });
                } else {
                    const animClose = Animated.timing(this.state.position, {
                        toValue:
                            this.props.entry === 'top'
                                ? -this.state.containerHeight
                                : this.state.containerHeight,
                        duration: this.props.animationDuration,
                        easing: this.props.easing,
                        useNativeDriver: this.props.useNativeDriver ?? true
                    });
                    // Keyboard.dismiss();   // make this optional. Easily user defined in .onClosed() callback
                    animClose.start(() => {
                        this.setState(
                            {
                                isAnimateClose: false,
                                animClose
                            },
                            () => {
                                /* Set the state to the starting position of the modal, preventing from animating where the swipe stopped */
                                this.state.position.setValue(
                                    this.props.entry === 'top'
                                        ? -this.state.containerHeight
                                        : this.state.containerHeight
                                );
                            }
                        );
                    });
                    if (this.props.onClosed) this.props.onClosed();
                }
            }
        );
    }

    /*
     * Calculate when should be placed the modal
     */
    calculateModalPosition(containerHeight: number) {
        let position = 0;

        if (this.props.position == 'bottom') {
            position = containerHeight - this.state.height;
        } else if (this.props.position == 'center') {
            position = containerHeight / 2 - this.state.height / 2;
        }
        // Checking if the position >= 0
        if (position < 0) position = 0;
        return position;
    }

    /*
     * Create the pan responder to detect gesture
     * Only used if swipeToClose is enabled
     */
    createPanResponder(position: any) {
        let closingState = false;
        let inSwipeArea = false;
        const {
            swipeThreshold = 50,
            entry,
            swipeToClose,
            isDisabled,
            swipeArea,
            onClosingState
        } = this.props;

        const onPanStart = (evt: any) => {
            if (
                !swipeToClose ||
                isDisabled ||
                (swipeArea &&
                    this.state.positionDest != undefined &&
                    evt.nativeEvent.pageY - this.state.positionDest > swipeArea)
            ) {
                inSwipeArea = false;
                return false;
            }
            inSwipeArea = true;
            return true;
        };

        const animEvt = Animated.event([null, { customY: position }], {
            useNativeDriver: false
        });

        const onPanMove = (evt: any, state: any) => {
            const newClosingState =
                entry === 'top'
                    ? -state.dy > swipeThreshold
                    : state.dy > swipeThreshold;
            if (entry === 'top' ? state.dy > 0 : state.dy < 0) return;
            if (newClosingState != closingState && onClosingState)
                onClosingState(newClosingState);
            closingState = newClosingState;
            state.customY = state.dy + this.state.positionDest;

            animEvt(evt, state);
        };

        const onPanRelease = (_evt: any, state: any) => {
            if (!inSwipeArea) return;
            inSwipeArea = false;
            if (
                entry === 'top'
                    ? -state.dy > swipeThreshold
                    : state.dy > swipeThreshold
            ) {
                this.close();
            } else if (!this.state.isOpen) {
                this.animateOpen();
            }
        };

        return PanResponder.create({
            onStartShouldSetPanResponder: onPanStart,
            onPanResponderMove: onPanMove,
            onPanResponderRelease: onPanRelease,
            onPanResponderTerminate: onPanRelease
        });
    }

    /*
     * Event called when the modal view layout is calculated
     */
    onViewLayout(evt: any) {
        const height = evt.nativeEvent.layout.height;
        const width = evt.nativeEvent.layout.width;

        // If the dimensions are still the same we're done
        const newState: { height: number; width: number } = {
            height,
            width
        };
        if (height !== this.state.height) newState.height = height;
        if (width !== this.state.width) newState.width = width;
        this.setState(newState);

        if (this.onViewLayoutCalculated) this.onViewLayoutCalculated();
    }

    /*
     * Event called when the container view layout is calculated
     */
    onContainerLayout(evt: any) {
        const height = evt.nativeEvent.layout.height;
        const width = evt.nativeEvent.layout.width;

        // If the container size is still the same we're done
        if (
            height == this.state.containerHeight &&
            width == this.state.containerWidth
        ) {
            this.setState({ isInitialized: true });
            return;
        }

        if (this.state.isOpen || this.state.isAnimateOpen) {
            this.animateOpen();
        }

        if (this.props.onLayout) this.props.onLayout(evt);
        this.setState({
            isInitialized: true,
            containerHeight: height,
            containerWidth: width
        });
    }

    /*
     * Render the backdrop element
     */
    renderBackdrop() {
        let backdrop = null;

        if (this.props.backdrop) {
            backdrop = (
                <TouchableWithoutFeedback
                    onPress={
                        this.props.backdropPressToClose ? this.close : undefined
                    }
                >
                    <Animated.View
                        importantForAccessibility="no"
                        style={[
                            styles.absolute,
                            { opacity: this.state.backdropOpacity }
                        ]}
                    >
                        <View
                            style={[
                                styles.absolute,
                                {
                                    backgroundColor: this.props.backdropColor,
                                    opacity: this.props.backdropOpacity
                                }
                            ]}
                        />
                        {this.props.backdropContent || []}
                    </Animated.View>
                </TouchableWithoutFeedback>
            );
        }

        return backdrop;
    }

    renderContent() {
        const { style }: { style?: StyleProp<ViewStyle> } = this.props;
        const size = {
            height: this.state.containerHeight,
            width: this.state.containerWidth
        };
        const offsetX = (this.state.containerWidth - this.state.width) / 2;

        const customHeightStyle =
            style &&
            typeof style === 'object' &&
            'height' in style &&
            style.height
                ? { height: (style.height as number) * FONT_SCALE }
                : undefined;

        return (
            <Animated.View
                onLayout={this.onViewLayout}
                style={[
                    styles.wrapper,
                    size,
                    style,
                    customHeightStyle,
                    {
                        transform: [
                            { translateY: this.state.position },
                            { translateX: offsetX }
                        ],
                        opacity:
                            this.props.entry === 'center'
                                ? this.state.backdropOpacity
                                : 1
                    }
                ]}
                {...this.state.pan.panHandlers}
            >
                {this.props.children}
            </Animated.View>
        );
    }

    /*
     * Render the component
     */
    render() {
        const visible =
            !this.props.SettingsStore!.loginRequired() &&
            (this.state.isOpen ||
                this.state.isAnimateOpen ||
                this.state.isAnimateClose);

        if (!visible) return <View />;

        const content = (
            <View
                importantForAccessibility="yes"
                accessibilityViewIsModal={true}
                style={[styles.transparent, styles.absolute]}
                pointerEvents={'box-none'}
            >
                <View
                    style={{ flex: 1 }}
                    pointerEvents={'box-none'}
                    onLayout={this.onContainerLayout}
                >
                    {visible && this.renderBackdrop()}
                    {visible && this.renderContent()}
                </View>
            </View>
        );

        if (!this.props.coverScreen) return content;

        return (
            <Modal
                onRequestClose={() => {
                    if (this.props.backButtonClose) {
                        this.close();
                    }
                }}
                supportedOrientations={[
                    'landscape',
                    'portrait',
                    'portrait-upside-down'
                ]}
                transparent
                visible={visible}
                hardwareAccelerated={true}
            >
                {content}
            </Modal>
        );
    }

    /****************** PUBLIC METHODS **********************/

    open() {
        if (this.props.isDisabled) return;
        if (
            !this.state.isAnimateOpen &&
            (!this.state.isOpen || this.state.isAnimateClose)
        ) {
            this.onViewLayoutCalculated = () => {
                this.animateOpen();
                if (this.props.backButtonClose && Platform.OS === 'android') {
                    this.backHandlerSubscription = BackHandler.addEventListener(
                        'hardwareBackPress',
                        this.onBackPress
                    );
                }
                this.onViewLayoutCalculated = null;
            };
            this.setState({ isAnimateOpen: true });
        }
    }

    close() {
        if (this.props.isDisabled) return;
        if (
            !this.state.isAnimateClose &&
            (this.state.isOpen || this.state.isAnimateOpen)
        ) {
            this.animateClose();
            if (this.backHandlerSubscription) {
                this.backHandlerSubscription.remove();
                this.backHandlerSubscription = null;
            }
        }
    }
}
