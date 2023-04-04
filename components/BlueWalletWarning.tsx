import { View } from 'react-native';
import { ErrorMessage } from './SuccessErrorMessage';
import stores from '../stores/Stores';
import { localeString } from '../utils/LocaleUtils';
import { Implementation } from '../enums';

export default function BlueWalletWarning() {
    const SettingsStore = stores.settingsStore;
    const node: any =
        SettingsStore.settings.nodes &&
        SettingsStore.settings.nodes[SettingsStore.settings.selectedNode || 0];
    const isLndHubIo =
        node.implementation === Implementation.lndhub &&
        (node.lndhubUrl.includes('https://lndhub.io') ||
            node.lndhubUrl.includes('https://lndhub.herokuapp.com'));

    if (!isLndHubIo) return;
    return (
        <View style={{ width: '100%', paddingLeft: 15, paddingRight: 15 }}>
            <ErrorMessage
                message={localeString('components.BlueWalletWarning.warning')}
                link="https://bluewallet.io/sunsetting-lndhub/"
                fontSize={15}
            />
        </View>
    );
}
