import React from 'react';
import { useState } from 'react';
import { getNewAddress } from '../views/Receive.tsx';
import { Button } from 'react-native-elements';
import { localeString } from './../utils/LocaleUtils';
import SettingsStore from './../stores/SettingsStore';

export default function NewAddressButton({ SettingsStore }) {
    const [loading, setLoading] = useState(false);
    function pressed() {
        setLoading(true);
        getNewAddress();
        setLoading(false);
    }
    getNewAddress = () => {
        const { SettingsStore } = SettingsStore;
        SettingsStore.getNewAddress();
    };
    if (loading === false) {
        return (
            <Button
                title={
                    implementation === 'lndhub'
                        ? localeString('views.Receive.getAddress')
                        : localeString('views.Receive.getNewAddress')
                }
                icon={{
                    name: 'fiber-new',
                    size: 25,
                    color: 'white'
                }}
                onPress={pressed()}
                buttonStyle={{
                    backgroundColor: 'orange',
                    borderRadius: 30
                }}
            />
        );
    } else {
        return (
            <Button
                title={
                    implementation === 'lndhub'
                        ? localeString('views.Receive.getAddress')
                        : localeString('views.Receive.getNewAddress')
                }
                icon={{
                    name: 'fiber-new',
                    size: 25,
                    color: 'white'
                }}
                buttonStyle={{
                    backgroundColor: 'orange',
                    borderRadius: 30
                }}
                disabled="true"
            />
        );
    }
}
