import * as React from 'react';
import { TouchableWithoutFeedback, View } from 'react-native';

import ModalBox from '../ModalBox';

interface CenteredModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

const CenteredModal: React.FC<CenteredModalProps> = ({
    isOpen,
    onClose,
    children
}) => (
    <ModalBox
        isOpen={isOpen}
        onClosed={onClose}
        entry="center"
        backdrop
        backdropPressToClose
        backButtonClose
        swipeToClose={false}
        backdropOpacity={0.5}
        style={{ backgroundColor: 'transparent' }}
    >
        <TouchableWithoutFeedback onPress={onClose}>
            <View
                style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center'
                }}
            >
                <TouchableWithoutFeedback onPress={() => {}}>
                    {children}
                </TouchableWithoutFeedback>
            </View>
        </TouchableWithoutFeedback>
    </ModalBox>
);

export default CenteredModal;
