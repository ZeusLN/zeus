import * as React from 'react';
import { Image, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Badge, Button, Header } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import LinearGradient from 'react-native-linear-gradient';

import NodeInfoStore from './../../stores/NodeInfoStore';
import UnitsStore from './../../stores/UnitsStore';
import BalanceStore from './../../stores/BalanceStore';
import SettingsStore from './../../stores/SettingsStore';

const TorIcon = require('./../../images/tor.png');

interface MainPaneProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    UnitsStore: UnitsStore;
    BalanceStore: BalanceStore;
    SettingsStore: SettingsStore;
}

interface MainPaneState {
    combinedBalance: boolean;
}

@inject('UnitsStore', 'SettingsStore')
@observer
export default class MainPane extends React.Component<MainPaneProps, MainPaneState> {
    state = {
        combinedBalance: false
    }

    render() {
        const { NodeInfoStore, UnitsStore, BalanceStore, SettingsStore, navigation } = this.props;
        const { combinedBalance } = this.state;
        const {changeUnits, getAmount, units } = UnitsStore;
        const { totalBlockchainBalance, unconfirmedBlockchainBalance, lightningBalance, pendingOpenBalance } = BalanceStore;
        const { settings, host } = SettingsStore;
        const { theme } = settings;
        const loading = NodeInfoStore.loading || BalanceStore.loading;

        const BalanceView = () => (
            <React.Fragment>
                <Text style={styles.lightningBalance}>
                    {units && getAmount(lightningBalance)} ⚡
                </Text>
                {pendingOpenBalance > 0 ? <Text style={styles.pendingBalance}>
                    {units && getAmount(pendingOpenBalance)} pending open
                </Text> : null}
                <Text style={styles.blockchainBalance}>
                    {units && getAmount(totalBlockchainBalance)} ⛓️
                </Text>
                {unconfirmedBlockchainBalance ? <Text style={styles.pendingBalance}>
                    {units && getAmount(unconfirmedBlockchainBalance)} pending
                </Text> : null}
            </React.Fragment>
        );

        const BalanceViewCombined = () => (
          <React.Fragment>
              <Text style={styles.lightningBalance}>
                  {units && getAmount(Number(totalBlockchainBalance) + Number(lightningBalance))}
              </Text>
              {unconfirmedBlockchainBalance || pendingOpenBalance ? <Text style={styles.pendingBalance}>
                  {units && getAmount(Number(pendingOpenBalance) + Number(unconfirmedBlockchainBalance))} pending
              </Text> : null}
          </React.Fragment>
        );

        const SettingsButton = () => (
            <View style={styles.settings}>
                <Button
                    title=""
                    icon={{
                        name: "settings",
                        size: 25,
                        color: "#fff"
                    }}
                    backgroundColor="transparent"
                    onPress={() => navigation.navigate('Settings')}
                />
            </View>
        );

        const NodeInfoBadge = () => (
            <View style={styles.nodeInfo}>
                {host && host.includes('.onion') && <TouchableOpacity onPress={() => navigation.navigate('NodeInfo')}><Image style={{ width: 25, height: 25 }} source={TorIcon} /></TouchableOpacity>}
                {host && !host.includes('.onion') && <Badge onPress={() => navigation.navigate('NodeInfo')} value={NodeInfoStore.testnet ? 'Testnet' : 'ⓘ'} />}
            </View>
        );

        let mainPane;

        if (loading) {
            mainPane = (
                <View style={theme === 'dark' ? styles.loadingContainerDark : styles.loadingContainer}>
                    <Header
                        rightComponent={<SettingsButton />}
                        backgroundColor='transparent'
                        outerContainerStyles={{ borderBottomWidth: 0 }}
                    />
                    <Button
                        title=""
                        loading
                        backgroundColor="transparent"
                        onPress={() => void(0)}
                    />
                </View>
            );
        } else if (!NodeInfoStore.error) {
           mainPane = (
               <View>
                    <LinearGradient colors={theme === 'dark' ? darkThemeGradient : lightThemeGradient} style={styles.container}>
                        <Header
                            leftComponent={<NodeInfoBadge />}
                            rightComponent={<SettingsButton />}
                            backgroundColor='transparent'
                            outerContainerStyles={{ borderBottomWidth: 0 }}
                        />
                        <TouchableOpacity
                            onPress={() => changeUnits()}
                            onLongPress={() => this.setState({ combinedBalance: !combinedBalance })}
                        >
                            {combinedBalance ? <BalanceViewCombined /> :<BalanceView />}
                        </TouchableOpacity>
                        <View style={styles.buttons}>
                            <Button
                                title="Send"
                                icon={{
                                    name: "arrow-forward",
                                    size: 25,
                                    color: "red"
                                }}
                                buttonStyle={{ backgroundColor: theme === 'dark' ? 'black' : 'white' }}
                                color={theme === 'dark' ? 'white' : 'black'}
                                onPress={() => navigation.navigate('Send')}
                                borderRadius={30}
                                raised={theme !== 'dark'}
                            />
                            <Button
                                title="Receive"
                                icon={{
                                    name: "arrow-downward",
                                    size: 25,
                                    color: "green"
                                }}
                                buttonStyle={{ backgroundColor: theme === 'dark' ? 'black' : 'white' }}
                                color={theme === 'dark' ? 'white' : 'black'}
                                onPress={() => navigation.navigate('Receive')}
                                borderRadius={30}
                                raised={theme !== 'dark'}
                            />
                        </View>
                    </LinearGradient>
               </View>
           );
        } else {
            mainPane = (
                <View style={theme === 'dark' ? styles.errorContainerDark : styles.errorContainer}>
                    <Text style={{ color: '#fff', fontSize: 20, marginTop: 20, marginBottom: 25 }}>{NodeInfoStore.errorMsg ? NodeInfoStore.errorMsg : 'Error connecting to your node. Please check your settings and try again.'}</Text>
                    <Button
                        icon={{
                            name: "settings",
                            size: 25,
                            color: "#fff"
                        }}
                        title="Go to Settings"
                        backgroundColor="gray"
                        onPress={() => navigation.navigate('Settings')}
                        borderRadius={30}
                    />
                </View>
            );
        }

        return (
            <React.Fragment>
                {mainPane}
            </React.Fragment>
        );
    }
}

const lightThemeGradient = ['#FAB57F', 'orange', '#ee7600'];
const darkThemeGradient = ['#33194d', '#261339', 'black'];

const styles = StyleSheet.create({
    container: {
        paddingTop: 10,
        paddingBottom: 50,
        paddingLeft: 10
    },
    loadingContainer: {
        backgroundColor: 'rgba(253, 164, 40, 0.5)',
        paddingTop: 10,
        paddingBottom: 50,
        paddingLeft: 10
    },
    loadingContainerDark: {
        backgroundColor: '#261339',
        paddingTop: 10,
        paddingBottom: 50,
        paddingLeft: 10
    },
    errorContainer: {
        backgroundColor: '#cc3300', // dark red
        paddingTop: 25,
        paddingBottom: 50,
        paddingLeft: 10
    },
    errorContainerDark: {
        backgroundColor: '#992600', // dark dark red
        paddingTop: 25,
        paddingBottom: 50,
        paddingLeft: 10
    },
    lightningBalance: {
        fontSize: 40,
        color: '#fff'
    },
    blockchainBalance: {
        fontSize: 30,
        color: '#fff'
    },
    pendingBalance: {
        fontSize: 20,
        color: '#fff'
    },
    settings: {
        alignItems: 'flex-end',
        marginRight: -40,
        marginBottom: -15
    },
    nodeInfo: {
        alignItems: 'flex-start',
        marginLeft: -15
    },
    buttons: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: -30
    }
});