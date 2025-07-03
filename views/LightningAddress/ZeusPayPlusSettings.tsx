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
    showPerks?: boolean;
}

@inject('LightningAddressStore')
@observer
export default class ZeusPayPlusSettings extends React.Component<
    ZeusPayPlusSettingsProps,
    {}
> {
    render() {
        const { navigation, LightningAddressStore, hidePills, showPerks } =
            this.props;
        const { zeusPlusExpiresAt, legacyAccount } = LightningAddressStore!!;

        const zeusPayPlus = !!zeusPlusExpiresAt;

        const LegacyPill = () =>
            !hidePills ? (
                <Pill
                    title={localeString('views.LightningAddress.legacyAccount')}
                    textColor={themeColor('text')}
                    borderColor={themeColor('text')}
                    width={160}
                    height={30}
                />
            ) : (
                <></>
            );

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

        const LegacyNavIcon = () => (
            <>
                <LegacyPill />
                <Icon
                    name="keyboard-arrow-right"
                    color={themeColor('text')}
                    style={{ marginLeft: 5 }}
                />
            </>
        );

        const NavIcon = () =>
            zeusPayPlus ? (
                <>
                    <PlusPill />
                    <Icon
                        name="keyboard-arrow-right"
                        color={themeColor('text')}
                        style={{ marginLeft: 5 }}
                    />
                </>
            ) : (
                <>
                    <PlusPillLocked />
                    <Icon
                        name="lock"
                        color={themeColor('secondaryText')}
                        style={{ marginLeft: 10 }}
                    />
                </>
            );

        return (
            <>
                <ListItem
                    containerStyle={{
                        backgroundColor: 'transparent',
                        padding: 0,
                        marginTop: 20
                    }}
                    onPress={() =>
                        legacyAccount || zeusPayPlus
                            ? navigation.navigate('ChangeAddress')
                            : null
                    }
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
                    {legacyAccount ? <LegacyNavIcon /> : <NavIcon />}
                </ListItem>
                <ListItem
                    containerStyle={{
                        backgroundColor: 'transparent',
                        padding: 0,
                        marginTop: 20
                    }}
                    onPress={() =>
                        zeusPayPlus ? navigation.navigate('WebPortalPOS') : null
                    }
                >
                    <ListItem.Content>
                        <ListItem.Title
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {localeString(
                                'views.Settings.LightningAddress.webPortalPos'
                            )}
                        </ListItem.Title>
                    </ListItem.Content>
                    <NavIcon />
                </ListItem>
                {showPerks && (
                    <ListItem
                        containerStyle={{
                            backgroundColor: 'transparent',
                            padding: 0,
                            marginTop: 20
                        }}
                        onPress={() =>
                            zeusPayPlus
                                ? navigation.navigate('ZeusPayPlusPerks')
                                : null
                        }
                    >
                        <ListItem.Content>
                            <ListItem.Title
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.Settings.LightningAddress.viewPlusPerks'
                                )}
                            </ListItem.Title>
                        </ListItem.Content>
                        <NavIcon />
                    </ListItem>
                )}
            </>
        );
    }
}
