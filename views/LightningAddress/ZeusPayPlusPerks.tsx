import * as React from 'react';
import { View } from 'react-native';

import Screen from '../../components/Screen';
import Header from '../../components/Header';

import { themeColor } from '../../utils/ThemeUtils';

import ZeusPayIcon from '../../assets/images/SVG/zeus-pay.svg';

import ZeusPayPlusPerksList from './ZeusPayPlusPerksList';

interface ZeusPayPlusPerksProps {
    navigation: any;
}

export default class ZeusPayPlusPerks extends React.PureComponent<
    ZeusPayPlusPerksProps,
    {}
> {
    render() {
        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={
                            <ZeusPayIcon
                                fill={themeColor('text')}
                                width={30}
                                height={30}
                            />
                        }
                        navigation={this.props.navigation}
                    />
                    <ZeusPayPlusPerksList />
                </View>
            </Screen>
        );
    }
}
