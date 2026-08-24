import { usePreventRemove } from '@react-navigation/native';

interface PreventRemoveProps {
    enabled: boolean;
    onAttempt: () => void;
}

/**
 * Blocks the screen from being popped while `enabled`, and runs `onAttempt`
 * instead. Unlike a bare `beforeRemove` listener, this registers with
 * react-navigation's prevent-remove context, which is what drives the native
 * `preventNativeDismiss` prop - without it the iOS swipe-back gesture pops the
 * screen natively before JS can call `preventDefault`.
 *
 * Renders nothing; mount it inside the screen it should guard, and toggle
 * `enabled` rather than conditionally rendering it.
 */
function PreventRemove(props: PreventRemoveProps) {
    const { enabled, onAttempt } = props;

    usePreventRemove(enabled, onAttempt);

    return null;
}

export default PreventRemove;
