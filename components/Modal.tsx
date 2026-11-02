import * as React from 'react';
import { Modal as NativeModal, ModalProps } from 'react-native';
import { observer } from 'mobx-react';

import { settingsStore } from '../stores/Stores';

// On iOS a visible React Native Modal is presented above the whole navigation
// stack, so the Lockscreen that the background lock pushes would open
// underneath it. Like ModalBox, hide it while login is required; the screen
// keeps its state, so the modal comes back as it was after the login. An
// active POS session is waived, as the Lockscreen waives it.
const Modal: React.FC<ModalProps> = observer((props) => {
    const locked =
        settingsStore.loginRequired() && settingsStore.posStatus !== 'active';

    return <NativeModal {...props} visible={locked ? false : props.visible} />;
});

export default Modal;
