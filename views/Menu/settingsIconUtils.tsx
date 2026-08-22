import * as React from 'react';
import { Text } from 'react-native';
import { Icon } from '@rneui/themed';

import AccountIcon from '../../assets/images/SVG/Account.svg';
import AddIcon from '../../assets/images/SVG/Add.svg';
import BlockIcon from '../../assets/images/SVG/Block.svg';
import Bolt12Icon from '../../assets/images/SVG/AtSign.svg';
import BrushIcon from '../../assets/images/SVG/Brush.svg';
import CashuIcon from '../../assets/images/SVG/Ecash.svg';
import ChannelsIcon from '../../assets/images/SVG/Channels.svg';
import CloudIcon from '../../assets/images/SVG/Cloud.svg';
import CoinsIcon from '../../assets/images/SVG/Coins.svg';
import ContactIcon from '../../assets/images/SVG/PeersContact.svg';
import CurrencyIcon from '../../assets/images/SVG/Bitcoin.svg';
import ExportImportIcon from '../../assets/images/SVG/ExportImport.svg';
import GearIcon from '../../assets/images/SVG/Gear.svg';
import KeyIcon from '../../assets/images/SVG/Key.svg';
import LanguageIcon from '../../assets/images/SVG/Globe.svg';
import MintIcon from '../../assets/images/SVG/Mint.svg';
import NetworkIcon from '../../assets/images/SVG/Network.svg';
import NodeOn from '../../assets/images/SVG/Node On.svg';
import NWCIcon from '../../assets/images/SVG/nwc-logo.svg';
import POS from '../../assets/images/SVG/POS.svg';
import PrivacyIcon from '../../assets/images/SVG/Eye On.svg';
import RebalanceIcon from '../../assets/images/SVG/RebalanceIcon.svg';
import ReceiveIcon from '../../assets/images/SVG/Receive.svg';
import RoutingIcon from '../../assets/images/SVG/Routing.svg';
import SecurityIcon from '../../assets/images/SVG/Lock.svg';
import SendIcon from '../../assets/images/SVG/Send.svg';
import SignIcon from '../../assets/images/SVG/Pen.svg';
import SpeedometerIcon from '../../assets/images/SVG/Speedometer.svg';
import SwapsIcon from '../../assets/images/SVG/Swap.svg';
import SweepIcon from '../../assets/images/SVG/Sweep.svg';
import WatchtowerIcon from '../../assets/images/SVG/Watchtower.svg';
import WrenchIcon from '../../assets/images/SVG/Wrench.svg';
import ZeusPayIcon from '../../assets/images/SVG/zeus-pay.svg';

import { SettingsIconKey } from './searchRegistry';

interface RenderSettingsIconParams {
    iconKey: SettingsIconKey;
    textColor: string;
    highlightColor: string;
    warningColor: string;
    secondaryColor: string;
    youveGotSats: boolean;
}

export const renderSettingsItemIcon = ({
    iconKey,
    textColor,
    highlightColor,
    warningColor,
    secondaryColor,
    youveGotSats
}: RenderSettingsIconParams) => {
    switch (iconKey) {
        case 'add':
            return <AddIcon fill={highlightColor} width={18} height={18} />;
        case 'wallets':
            return (
                <Icon
                    name="account-balance-wallet"
                    type="material"
                    color={textColor}
                    size={23}
                />
            );
        case 'settings':
            return <GearIcon fill={textColor} width={25} height={25} />;
        case 'seed':
            return <KeyIcon fill={textColor} width={27} height={27} />;
        case 'embedded-node':
            return <BlockIcon color={textColor} width={27} height={27} />;
        case 'node-info':
            return <NodeOn color={textColor} />;
        case 'network-info':
            return <NetworkIcon fill={textColor} width={24} height={24} />;
        case 'mints':
            return <MintIcon fill={textColor} width={24} height={24} />;
        case 'lightning-address':
            return (
                <ZeusPayIcon
                    height={19.25}
                    width={22}
                    fill={youveGotSats ? highlightColor : textColor}
                />
            );
        case 'swaps':
            return <SwapsIcon fill={textColor} height={25} width={25} />;
        case 'onchain-addresses':
            return <CoinsIcon fill={textColor} height={30} width={30} />;
        case 'bolt12-address':
            return <Bolt12Icon fill={textColor} width={48} height={30} />;
        case 'paycodes':
            return <ReceiveIcon fill={textColor} width={48} height={30} />;
        case 'routing':
            return (
                <RoutingIcon
                    stroke={textColor}
                    fill={textColor}
                    width={27}
                    height={27}
                />
            );
        case 'contacts':
            return <ContactIcon fill={textColor} width={27} height={27} />;
        case 'tools':
            return <WrenchIcon fill={textColor} width={25} height={25} />;
        case 'support':
            return (
                <Icon
                    name="favorite"
                    color={textColor}
                    underlayColor="transparent"
                    size={23}
                />
            );
        case 'help':
            return (
                <Icon
                    name="support"
                    color={textColor}
                    underlayColor="transparent"
                    size={23}
                />
            );
        case 'lsp':
            return <CloudIcon fill={textColor} width={25} height={25} />;
        case 'ecash':
            return <CashuIcon fill={textColor} width={20} height={20} />;
        case 'payments':
            return <SendIcon fill={textColor} width={27} height={27} />;
        case 'invoices':
            return <ReceiveIcon fill={textColor} width={27} height={27} />;
        case 'channels':
            return <ChannelsIcon fill={textColor} width={27} height={27} />;
        case 'privacy':
            return <PrivacyIcon fill={textColor} />;
        case 'security':
            return <SecurityIcon fill={textColor} width={26} height={26} />;
        case 'currency':
            return <CurrencyIcon fill={textColor} width={18} height={18} />;
        case 'language':
            return <LanguageIcon fill={textColor} />;
        case 'display':
            return <BrushIcon fill={textColor} width={28} height={28} />;
        case 'pos':
            return (
                <POS
                    stroke={textColor}
                    fill={secondaryColor}
                    width={23}
                    height={23}
                />
            );
        case 'accounts':
            return <AccountIcon fill={textColor} />;
        case 'nwc':
            return <NWCIcon fill={textColor} width={23} height={23} />;
        case 'watchtowers':
            return <WatchtowerIcon fill={textColor} width={23} height={23} />;
        case 'bump-fee':
            return <SpeedometerIcon fill={textColor} width={23} height={23} />;
        case 'sign-verify':
            return <SignIcon fill={textColor} width={18} height={18} />;
        case 'converter':
            return <CurrencyIcon fill={textColor} width={18} height={18} />;
        case 'rebalance':
            return <RebalanceIcon fill={textColor} width={18} height={18} />;
        case 'sweep':
            return <SweepIcon fill={textColor} width={18} height={18} />;
        case 'wif-sweeper':
            return (
                <Icon
                    name="key-plus"
                    type="material-design"
                    color={textColor}
                    size={25}
                />
            );
        case 'activity-export':
            return (
                <Icon
                    name="upload"
                    type="feather"
                    color={textColor}
                    underlayColor="transparent"
                    size={18}
                />
            );
        case 'config-export-import':
            return (
                <ExportImportIcon stroke={textColor} width={18} height={18} />
            );
        case 'withdrawal-request':
            return (
                <Icon
                    name="edit"
                    type="feather"
                    color={textColor}
                    underlayColor="transparent"
                    size={18}
                />
            );
        case 'developer-tools':
            return (
                <Text
                    style={{
                        color: textColor,
                        fontSize: 14,
                        fontFamily: 'PPNeueMontreal-Book'
                    }}
                >
                    {'</>'}
                </Text>
            );
        case 'clear-storage':
            return (
                <Icon
                    name="trash-2"
                    type="feather"
                    color={warningColor}
                    size={20}
                />
            );
        default:
            return (
                <Icon
                    name="search"
                    color={textColor}
                    underlayColor="transparent"
                    size={20}
                />
            );
    }
};
