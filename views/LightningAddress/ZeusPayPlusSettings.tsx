import * as React from 'react';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Pill from '../../components/Pill';

import LightningAddressStore from '../../stores/LightningAddressStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface ZeusPayPlusSettingsProps {
    navigation: StackNavigationProp<any, any>;
    LightningAddressStore?: LightningAddressStore;
    hidePills?: boolean;
}

@inject('LightningAddressStore')
@observer
export default class ZeusPayPlusSettings extends React.Component<
    ZeusPayPlusSettingsProps,
    {}
> {
    render() {
        const { navigation, LightningAddressStore, hidePills } = this.props;
        const { zeusPlusExpiresAt } = LightningAddressStore!!;

        const zeusPayPlus = !!zeusPlusExpiresAt;

        const PlusPill = () =>
            !hidePills ? (
                <Pill
                    title="ZEUS Pay+"
                    textColor={themeColor('text')}
                    borderColor={themeColor('text')}
                    width={100}
                    height={30}
                />
            ) : (
                <></>
            );
        const PlusPillLocked = () => (
            <Pill
                title="ZEUS Pay+"
                textColor={themeColor('secondaryText')}
                borderColor={themeColor('secondaryText')}
                width={100}
                height={30}
            />
        );

        return (
            <>
                {zeusPayPlus ? (
                    <>
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent',
                                padding: 0,
                                marginTop: 20
                            }}
                            onPress={() => navigation.navigate('ChangeAddress')}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.LightningAddress.ChangeAddress'
                                    )}
                                </ListItem.Title>
                            </ListItem.Content>
                            <PlusPill />
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('text')}
                            />
                        </ListItem>
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent',
                                padding: 0,
                                marginTop: 20
                            }}
                            onPress={() => navigation.navigate('WebPortalPOS')}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.LightningAddress.webPoralPos'
                                    )}
                                </ListItem.Title>
                            </ListItem.Content>
                            <PlusPill />
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('text')}
                            />
                        </ListItem>
                    </>
                ) : (
                    <>
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent',
                                padding: 0,
                                marginTop: 20
                            }}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.LightningAddress.ChangeAddress'
                                    )}
                                </ListItem.Title>
                            </ListItem.Content>
                            <PlusPillLocked />
                            <Icon
                                name="lock"
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent',
                                padding: 0,
                                marginTop: 20
                            }}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.LightningAddress.webPoralPos'
                                    )}
                                </ListItem.Title>
                            </ListItem.Content>
                            <PlusPillLocked />
                            <Icon
                                name="lock"
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>
                    </>
                )}
            </>
        );
    }
}
