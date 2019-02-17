import * as React from 'react';
import { Clipboard } from 'react-native';
import { Button } from 'react-native-elements';

interface CopyButtonProps {
    title?: string;
    copyValue: string;
}

interface CopyButtonState {
    copied: boolean;
}

export default class CopyButton extends React.Component<CopyButtonProps, CopyButtonState> {
    state = {
        copied: false
    }

    copyToClipboard = () => {
        const { copyValue } = this.props;
        this.setState({
            copied: true
        });

        Clipboard.setString(copyValue);

        setTimeout(() => {
            this.setState({
                copied: false
            });
        }, 5000);
    }

    render() {
        const { copied } = this.state;
        const { title } = this.props;

        const buttonTitle = copied ? "Copied!" : (title || "Copy to Clipboard");

        return (
            <Button
                title={buttonTitle}
                icon={{
                    name: "content-copy",
                    size: 25,
                    color: copied ? "black" : "white"
                }}
                backgroundColor={copied ? "white" : "black"}
                color={copied ? "black" : "white"}
                onPress={() => this.copyToClipboard()}
                borderRadius={30}
            />
        );
    }
}