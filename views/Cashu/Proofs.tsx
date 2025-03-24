import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Button, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import cloneDeep from 'lodash/cloneDeep';

import Amount from '../../components/Amount';
import Header from '../../components/Header';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import CashuStore from '../../stores/CashuStore';

interface ProofsProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    route: Route<'Proofs'>;
}

interface ProofsState {
    allProofs: any;
}

@inject('CashuStore')
@observer
export default class Proofs extends React.Component<ProofsProps, ProofsState> {
    UNSAFE_componentWillMount(): void {
        const { CashuStore } = this.props;
        const { cashuWallets, mintUrls } = CashuStore;
        let allProofs: any = [];
        mintUrls.forEach((mintUrl) => {
            const { wallet } = cashuWallets[mintUrl];
            const mintProofs = cloneDeep(cashuWallets[mintUrl].proofs);
            mintProofs.forEach((proof: any) => {
                proof.mint = wallet?.mintInfo?.name || mintUrl;
            });
            allProofs.push(...mintProofs);
        });

        this.setState({
            allProofs
        });
    }
    renderSeparator = () => (
        <View
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    render() {
        const { navigation } = this.props;
        const { allProofs } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text:
                            allProofs.length > 0
                                ? `${localeString('cashu.proofs')} (${
                                      allProofs.length
                                  })`
                                : localeString('cashu.proofs'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                {!!allProofs && allProofs.length > 0 ? (
                    <FlatList
                        data={allProofs}
                        renderItem={({ item }) => {
                            const subTitle = `${item.mint} - ${item.id}`;

                            return (
                                <React.Fragment>
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: 'transparent'
                                        }}
                                    >
                                        <ListItem.Content>
                                            <Amount
                                                sats={item.amount}
                                                sensitive
                                            />
                                            <ListItem.Subtitle
                                                right
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    fontSize: 10,
                                                    fontFamily: 'Lato-Regular',
                                                    flexShrink: 0,
                                                    flex: 0,
                                                    width: 'auto',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                {subTitle}
                                            </ListItem.Subtitle>
                                        </ListItem.Content>
                                    </ListItem>
                                </React.Fragment>
                            );
                        }}
                        keyExtractor={(_, index) => `utxo-${index}`}
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                    />
                ) : (
                    <Button
                        title={localeString('views.Proofs.noProofs')}
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: themeColor('text')
                        }}
                        buttonStyle={{
                            backgroundColor: 'transparent',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    />
                )}
            </Screen>
        );
    }
}
