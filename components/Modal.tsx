import * as React from 'react';
import { Modal as NativeModal, ModalProps } from 'react-native';
import { observer } from 'mobx-react';

import { settingsStore } from '../stores/Stores';

// On iOS a visible React Native Modal is presented above the whole navigation
// stack, so the Lockscreen that the background lock pushes would open
// underneath it. Like ModalBox, hide it while login is required; the screen
// keeps its state, so the modal comes back as it was after the login. An
// active POS session is waived under the same condition as the Lockscreen's
// waiver (POS enabled and active), so the two cannot disagree.
const Modal: React.FC<ModalProps> = observer((props) => {
    const posSession =
        settingsStore.isPosEnabled() && settingsStore.posStatus === 'active';
    const locked = settingsStore.loginRequired() && !posSession;

    return <NativeModal {...props} visible={locked ? false : props.visible} />;
});

export default Modal;
