import * as React from 'react';
import { ActionSheetIOS, Picker, Platform, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Button, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Nodes from './Settings/Nodes';

import SettingsStore from './../stores/SettingsStore';

interface SettingsProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface SettingsState {
    nodes: any[];
    theme: string;
    saved: boolean;
    loading: boolean;
}

const themes: any = {
    light: 'Light Theme',
    dark: 'Dark Theme'
};

@inject('SettingsStore')
@observer
export default class Settings extends React.Component<SettingsProps, SettingsState> {
    isComponentMounted: boolean = false;

    state = {
          nodes: [],
          theme: 'light',
          saved: false,
          loading: false
    }

    componentDidMount() {
        const { SettingsStore } = this.props;
        const { getSettings, settings } = SettingsStore;
        this.refreshSettings();

        this.isComponentMounted = true;

        if (settings) {
            this.setState({
                nodes: settings.nodes || [],
                theme: settings.theme || ''
            });
        }
    }

    componentWillReceiveProps = (newProps: any) => {
        const { SettingsStore } = newProps;
        const { settings } = SettingsStore;

        this.refreshSettings().then(() => {
            if (settings) {
                this.setState({
                    nodes: settings.nodes || [],
                    theme: settings.theme || ''
                });
            }
        });
    }

    componentWillUnmount() {
        this.isComponentMounted = false;
    }

    refreshSettings() {
        this.setState({
            loading: true
        });
        return this.props.SettingsStore.getSettings().then(() => {
            this.setState({
                loading: false
            });
        });
    }

    saveSettings = () => {
        const { SettingsStore } = this.props;
        const { nodes, theme } = this.state;
        const { setSettings, settings } = SettingsStore;

        setSettings(JSON.stringify({
            nodes,
            theme,
            onChainAndress: settings.onChainAndress
        }));

        this.setState({
            saved: true
        });

        this.refreshSettings();

        setTimeout(() => {
            if (this.isComponentMounted) {
                this.setState({
                    saved: false
                });
            }
        }, 5000);
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { saved, theme, nodes } = this.state;
        const { loading, settings } = SettingsStore;
        const savedTheme = settings.theme;
        const selectedNode = settings.selectedNode;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet', { refresh: true })}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View style={savedTheme === 'dark' ? styles.darkThemeStyle : styles.lightThemeStyle}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{ text: 'Settings', style: { color: '#fff' } }}
                    backgroundColor={savedTheme === 'dark' ? '#261339' : 'rgba(92, 99,216, 1)'}
                />

                {loading && <Button
                    title=""
                    loading
                    buttonStyle={{
                        backgroundColor: 'transparent'
                    }}
                    onPress={() => void(0)}
                />}

                <View style={styles.form}>
                    <Nodes nodes={nodes} navigation={navigation} theme={theme} loading={loading} selectedNode={selectedNode} />
                </View>

                {Platform.OS !== 'ios' && <View style={styles.pickerWrapper}>
                    <Text style={{ color: savedTheme === 'dark' ? 'white' : 'black' }}>Theme</Text>
                    <Picker
                        selectedValue={theme}
                        onValueChange={(itemValue: string) => this.setState({ theme: itemValue })}
                        style={savedTheme === 'dark' ? styles.pickerDark : styles.picker}
                    >
                        <Picker.Item label='Light' value='light' />
                        <Picker.Item label='Dark' value='dark' />
                    </Picker>
                </View>}

                {Platform.OS === 'ios' && <View style={styles.pickerWrapper}>
                    <Text style={{ color: savedTheme === 'dark' ? 'white' : 'black' }}>Theme</Text>
                    <TouchableOpacity onPress={() => ActionSheetIOS.showActionSheetWithOptions(
                      {
                        options: ['Cancel', 'Light Theme', 'Dark Theme'],
                        cancelButtonIndex: 0,
                      },
                      (buttonIndex) => {
                        if (buttonIndex === 1) {
                            this.setState({ theme: 'light' })
                        } else if (buttonIndex === 2) {
                            this.setState({ theme: 'dark' })
                        }
                      },
                    )}><Text style={{ color: savedTheme === 'dark' ? 'white' : 'black' }}>{themes[theme]}</Text></TouchableOpacity>
                </View>}

                <View style={styles.button}>
                    <Button
                        title={saved ? "Settings Saved!" : "Save Settings"}
                        icon={{
                            name: "save",
                            size: 25,
                            color: saved ? "black" : "white"
                        }}
                        onPress={() => this.saveSettings()}
                        style={styles.button}
                        buttonStyle={{
                            backgroundColor: saved ? "#fff" : savedTheme === 'dark' ? '#261339' : 'rgba(92, 99,216, 1)',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: saved ? "black" : "white"
                        }}
                    />
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1
    },
    darkThemeStyle: {
        flex: 1,
        backgroundColor: 'black',
        color: 'white'
    },
    textInput: {
        fontSize: 20,
        color: 'black'
    },
    textInputDark: {
        fontSize: 20,
        color: 'white'
    },
    error: {
        color: 'red'
    },
    form: {
        paddingTop: 20,
        paddingLeft: 5,
        paddingRight: 5
    },
    pickerWrapper: {
        paddingLeft: 5,
        paddingRight: 5
    },
    picker: {
        height: 50,
        width: 100
    },
    pickerDark: {
        height: 50,
        width: 100,
        color: 'white'
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10,
        width: 350,
        alignSelf: 'center'
    }
});