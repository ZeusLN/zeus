import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-elements';
import QRCode from 'react-native-qrcode';
import CopyButton from './CopyButton';

interface CollapsedQRProps {
    theme: any;
    value: string;
    copyText?: string;
}

interface CollapsedQRState {
    collapsed: boolean;
}

export default class CollapsedQR extends React.Component<
    CollapsedQRProps,
    CollapsedQRState
> {
    state = {
        collapsed: true
    };

    toggleCollapse = () => {
        this.setState({
            collapsed: !this.state.collapsed
        });
    };

    render() {
        const { collapsed } = this.state;
        const { theme, value, copyText } = this.props;

        return (
            <React.Fragment>
                <Text
                    style={theme === 'dark' ? styles.valueDark : styles.value}
                >
                    {value}
                </Text>
                {!collapsed && (
                    <View style={styles.qrPadding}>
                        <QRCode value={value} size={200} fgColor="white" />
                    </View>
                )}
                <Button
                    title={collapsed ? 'Show QR' : 'Hide QR'}
                    icon={{
                        name: 'qrcode',
                        type: 'font-awesome',
                        size: 25,
                        color: '#fff'
                    }}
                    buttonStyle={{
                        backgroundColor: 'grey',
                        borderRadius: 30
                    }}
                    containerStyle={{
                        paddingTop: collapsed ? 10 : 0,
                        paddingBottom: 10
                    }}
                    onPress={() => this.toggleCollapse()}
                />
                <CopyButton copyValue={value} title={copyText || 'Copy'} />
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
    value: {
        marginBottom: 15
    },
    valueDark: {
        marginBottom: 15,
        color: 'white'
    },
    qrPadding: {
        width: 250,
        height: 250,
        backgroundColor: 'white',
        alignItems: 'center',
        alignSelf: 'center',
        paddingTop: 25,
        marginBottom: 10
    }
});
