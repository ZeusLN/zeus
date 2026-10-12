import { Dimensions, ScaledSize } from 'react-native';
import { observable } from 'mobx';

// Widest a single column of content gets. Phones are narrower than this, so
// it only applies on tablets, unfolded foldables and landscape.
export const MAX_CONTENT_WIDTH = 600;

export const getContentWidth = (windowWidth: number): number =>
    Math.max(0, Math.min(windowWidth, MAX_CONTENT_WIDTH));

// Dimensions.get() returns the size at call time but does not re-render
// anything when the window is resized (rotation, folding, Split View). This
// box is updated on every change, so @observer components that read it in
// render() re-render with the new size. Function components should use
// useWindowDimensions() instead.
const windowDimensions = observable.box<ScaledSize>(Dimensions.get('window'), {
    deep: false
});

Dimensions.addEventListener('change', ({ window }) =>
    windowDimensions.set(window)
);

export const getWindowDimensions = (): ScaledSize => windowDimensions.get();
