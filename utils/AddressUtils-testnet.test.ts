jest.mock('react-native-encrypted-storage', () => ({
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve())
}));

jest.mock('../stores/Stores', () => ({
    SettingsStore: {
        settings: {
            display: {
                removeDecimalSpaces: false
            }
        }
    },
    nodeInfoStore: {
        nodeInfo: {
            isTestNet: true,
            isRegTest: false
        }
    }
}));

import AddressUtils from './AddressUtils';

describe('AddressUtils', () => {
    describe('scriptPubKeyToAddress', () => {
        test('should correctly decode a P2WSH scriptPubKey - testnet', () => {
            let scriptPubKey, expectedAddress;
            scriptPubKey =
                '002008737603b10129fc2dcb2e5167eb556ba2c84aec6622ff4d46767d186f63150d';
            expectedAddress =
                'tb1qppehvqa3qy5lctwt9egk0664dw3vsjhvvc307n2xwe73smmrz5xsrsq8yw';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey =
                '0020a1157ce5620e1e93ad8a98a9765971c89b5920a343add041b47ec34b7302d951';
            expectedAddress =
                'tb1q5y2heetzpc0f8tv2nz5hvkt3ezd4jg9rgwkaqsd50mp5kuczm9gssy38uc';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey =
                '0020983cca35d586a96de538166552d2773ed291b96a3af65917560ee7eda5e9e106';
            expectedAddress =
                'tb1qnq7v5dw4s65kmefczej495nh8mffrwt28tm9j96kpmn7mf0fuyrqs8aldv';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey =
                '0020c273ca3b47fcab3a53c9cc4daacfb37d921e62014c794f6d25606f43797fc0f0';
            expectedAddress =
                'tb1qcfeu5w68lj4n557fe3x64nan0kfpucspf3u57mf9vph5x7tlcrcquq4gza';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );
        });

        test('should correctly decode a P2SH scriptPubKey - testnet', () => {
            let scriptPubKey, expectedAddress;
            scriptPubKey = 'a91426101b3dae044fddcd71e6dfe831ebe383f23a5887';
            expectedAddress = '2MviUxfcKQdqszQPxofWjY4gCFQifcfG31b';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey = 'a914b40fce0fca1eefcec03e61e833bf6326c11ccaf087';
            expectedAddress = '2N9fJYxagvUGVCcN4utpBhRMgG7eLAjZT9F';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey = 'a9142d2ecbffc89a98365e2b45e90f00d3f6edec68d687';
            expectedAddress = '2MwN8TRK2jz44dBxvcebZzbqAYLC1MV3e3N';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );
        });

        test('should correctly decode a P2WPKH scriptPubKey - testnet', () => {
            let scriptPubKey, expectedAddress;

            scriptPubKey =
                '00201ff7ed9fecf23980cb3e6d9db8331054942aee8ca34b7190450e20a69ffeeda2';
            expectedAddress =
                'tb1qrlm7m8lv7gucpje7dkwmsvcs2j2z4m5v5d9hryz9pcs2d8l7ak3q2c7047';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey = '0014def7b24f3e42b0858240cf3b993a3d44a7f5abe9';
            expectedAddress = 'tb1qmmmmyne7g2cgtqjqeuaejw3agjnlt2lftcxm8w';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey = '0014e8550bc74d38fd002481339349ed4780cb1d77b3';
            expectedAddress = 'tb1qap2sh36d8r7sqfypxwf5nm28sr936aan8980fa';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey = '0014647f217856160110ce3abcc8cc2ec77ff39561ad';
            expectedAddress = 'tb1qv3ljz7zkzcq3pn36hnyvctk80lee2cddknywz0';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );
        });

        test('should correctly decode a P2TR scriptPubKey - testnet', () => {
            let scriptPubKey, expectedAddress;

            scriptPubKey =
                '5120fb3c4af6e6471fe9319afcfd25eb3daf2b83e5be7411b1932bb36ed84701337f';
            expectedAddress =
                'tb1plv7y4ahxgu07jvv6ln7jt6ea4u4c8ed7wsgmryetkdhds3cpxdlsp8yh6m';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey =
                '512071d18973aa5daf214d500de76c1b860fcac1228260af21a62d5f6eed74cb0547';
            expectedAddress =
                'tb1pw8gcjua2tkhjzn2sphnkcxuxpl9vzg5zvzhjrf3dtahw6axtq4rsnn9w4l';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey =
                '5120bd6b2524312d1ce75e7e00676b1da2f6b72a846ca767b3009f09b471623a5865';
            expectedAddress =
                'tb1ph44j2fp395wwwhn7qpnkk8dz76mj4prv5anmxqylpx68zc36tpjs7hyrpn';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey =
                '5120ad55091d54ca1938cebe01f5435790c352021df23d8153a301cd90d06171ceed';
            expectedAddress =
                'tb1p442sj825egvn3n47q865x4uscdfqy80j8kq48gcpekgdqct3emksxu4anx';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );
        });
    });
});
