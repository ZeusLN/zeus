jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Header: 'Header' }));
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/QRCodeScanner', () => 'QRCodeScanner');
jest.mock('../utils/ThemeUtils', () => ({ themeColor: () => '#000000' }));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/handleAnything', () => jest.fn());

import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { UREncoder } from '@ngraveio/bc-ur';
import { CryptoPSBT } from '@keystonehq/bc-ur-registry';
import HandleAnythingQRScanner from './HandleAnythingQRScanner';
import handleAnything from '../utils/handleAnything';

const mockHandleAnything = handleAnything as jest.Mock;

// BIP84 test vector account 0 ("abandon ... about"), master fingerprint
// 73C5DA0A, encoded as a single-part crypto-account UR (BCR-2020-015).
const ZPUB =
    'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';
const CRYPTO_ACCOUNT_UR =
    'ur:crypto-account/oeadcyjksktnbkaolytaadmwtaaddloxaxhdclaojoknidzcpssajtptrpfrcecfkkamykjtvtcsbtbdtkcfiyvyoetneeykwfnbnyndaahdcxgegunbpyclrhuomdlnnsglmooyhscfglaxrtwsfhykadgeswmowkeosskoghmhztamtaaddyotadlncsghykaeykaeykaocyjksktnbkaxaxaycykbwfdnuymnoyoldn';

// Multi-account export from the bc-ur-registry test suite (BCR-2020-015
// crypto-account, master fingerprint 37B5EED4, six output descriptors),
// split into two animated frames.
const SPEC_ACCOUNT_FRAMES = [
    'ur:crypto-account/1-2/lpadaocfaohpcygdaogykbhkaddmoeadcyemrewytyaolnta' +
        'admutaaddloxaxhdclaxwmfmdeiamecsdsemgtvsjzcncygrkowtrontzschgezokstswk' +
        'kscfmklrtauteyaahdcxiehfonurdppfyntapejpproypegrdawkgmaewejlsfdtsrfybd' +
        'ehcaflmtrlbdhpamtaaddyoyadlncsdwykaeykaeykaycynlytsnyltaadmhtaadmwtaad' +
        'dloxaxhdclaostvelfemdyynwydwyaievosrgmambklovabdgypdglldvespsthysadamh' +
        'pmjeinaahdcxntdllnaaeykoytdacygegwhgjsiyonpywmcmrpwphsvodsrerozsbyaxlu' +
        'zcoxdpamtaaddyoyadlncsehykaeykaeykaycypdbskeuytaadmwtaaddloxaxhdclaxzc' +
        'fxeegdrpmogrgwkbzctlttweadkiengrwlhtprremouoluutqdpfbncedkynfhaahdcxjp' +
        'wevdeogthttkmeswzcolcpsaahcfnshkhtehytclmnteatmoteadtlwynnftloamtaaddy' +
        'oyadlncsghykaeykaeykaycyadgsdacn',
    'ur:crypto-account/2-2/lpaoaocfaohpcygdaogykbhkaddmbthlvytstaadmhtaaddl' +
        'oxaxhdclaxhhsnhdrpftdwuocntilydibehnecmovdfekpjkclcslasbhkpawsaddmcmmn' +
        'ahnyaahdcxlotedtndfymyltclhlmtpfsadscnhtztaolbnnkistaedegwfmmedreetnwm' +
        'cycnamtaaddyoyadlfcsdpykaycyemrewytytaadmhtaadmetaaddloxaxhdclaxdwkswm' +
        'ztpytnswtsecnblfbayajkdldeclqzzolrsnhljedsgminetytbnahatbyaahdcxkkguws' +
        'vyimjkvwteytwztyswvendtpmncpasfrrylprnhtkblndrgrmkoyjtbkrpamtaaddyoyad' +
        'locsdyykaeykaeykadykaycyhkrpnddrtaadmetaaddloxaxhdclaohnhffmvsbndslrfg' +
        'clpfjejyatbdpebacnzokotofxntaoemvskpaowmryfnotfgaahdcxdlnbvecentssfsss' +
        'gylnhkrstoytecrdlyadrekirfaybglahltalsrfcaeerobwamtaaddyoyadlocsdyykae' +
        'ykaeykaoykaycyhkrpnddraejnfeptoy'
];

// `bytes` UR carrying the UTF-8 string "hello from a UR".
const BYTES_UR = 'ur:bytes/gwisihjzjzjlcxiyjpjljncxhscxgogmsfoyrsrl';

// crypto-account UR whose CBOR payload is an empty map.
const MALFORMED_ACCOUNT_UR = 'ur:crypto-account/nbaatygsih';

// A signed-input PSBT, long enough to need several animated frames.
const PSBT_BASE64 =
    'cHNidP8BAHUCAAAAASaBcTce3/KF6Tet7qSze3gADAVmy7OtZGQXE8pCFxv2AAAAAAD+////AtPf9QUAAAAAGXapFNDFmQPFusKGh2DpD9UhpGZap2UgiKwA4fUFAAAAABepFDVF5uM7gyxHBQ8k0+65PJwDlIvHh7MuEwAAAQD9pQEBAAAAAAECiaPHHqtNIOA3G7ukzGmPopXJRjr6Ljl/hTPMti+VZ+UBAAAAFxYAFL4Y0VKpsBIDna89p95PUzSe7LmF/////4b4qkOnHf8USIk6UwpyN+9rRgi7st0tAXHmOuxqSJC0AQAAABcWABT+Pp7xp0XpdNkCxDVZQ6vLNL1TU/////8CAMLrCwAAAAAZdqkUhc/xCX/Z4Ai7NK9wnGIZeziXikiIrHL++E4sAAAAF6kUM5cluiHv1irHU6m80GfWx6ajnQWHAkcwRAIgJxK+IuAnDzlPVoMR3HyppolwuAJf3TskAinwf4pfOiQCIAGLONfc0xTnNMkna9b7QPZzMlvEuqFEyADS8vAtsnZcASED0uFWdJQbrUqZY3LLh+GFbTZSYG2YVi/jnF6efkE/IQUCSDBFAiEA0SuFLYXc2WHS9fSrZgZU327tzHlMDDPOXMMJ/7X85Y0CIGczio4OFyXBl/saiK9Z9R5E5CVbIBZ8hoQDHAXR8lkqASECI7cr7vCWXRC+B3jv7NYfysb3mk6haTkzgHNEZPhPKrMAAAAAAAAA';
const PSBT_BYTES = Buffer.from(PSBT_BASE64, 'base64');

const psbtFrames = (maxFragmentLength: number): string[] => {
    const encoder: UREncoder = new CryptoPSBT(PSBT_BYTES).toUREncoder(
        maxFragmentLength
    );
    const frames: string[] = [];
    for (let i = 0; i < encoder.fragmentsLength; i++) {
        frames.push(encoder.nextPart());
    }
    return frames;
};

const mount = async () => {
    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    await render(<HandleAnythingQRScanner navigation={navigation as any} />);
    return navigation;
};

const camera = () =>
    screen.container.queryAll((n) => n.type === 'QRCodeScanner')[0];

// Hands `data` to the camera's scan callback, as QRCodeScanner does.
const scan = async (data: string) =>
    act(async () => camera().props.handleQRScanned(data));

beforeEach(() => {
    jest.clearAllMocks();
    mockHandleAnything.mockResolvedValue(['Route', { from: 'scan' }]);
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('HandleAnythingQRScanner BC-UR', () => {
    it('turns a crypto-account UR into the fingerprint and zpub', async () => {
        const navigation = await mount();
        await scan(CRYPTO_ACCOUNT_UR);

        expect(mockHandleAnything).toHaveBeenCalledTimes(1);
        expect(JSON.parse(mockHandleAnything.mock.calls[0][0])).toEqual({
            MasterFingerprint: '73C5DA0A',
            ExtPubKey: ZPUB
        });
        expect(navigation.navigate).toHaveBeenCalledWith('Route', {
            from: 'scan'
        });
    });

    it('decodes the multi-account crypto-account test vector', async () => {
        await mount();
        await scan(SPEC_ACCOUNT_FRAMES[0]);
        expect(mockHandleAnything).not.toHaveBeenCalled();
        await scan(SPEC_ACCOUNT_FRAMES[1]);

        expect(mockHandleAnything).toHaveBeenCalledTimes(1);
        expect(
            JSON.parse(mockHandleAnything.mock.calls[0][0]).MasterFingerprint
        ).toBe('37B5EED4');
    });

    it('turns a single-part crypto-psbt UR into base64', async () => {
        const frames = psbtFrames(10000);
        expect(frames).toHaveLength(1);
        const [frame] = frames;

        await mount();
        await scan(frame);

        expect(mockHandleAnything).toHaveBeenCalledWith(
            PSBT_BYTES.toString('base64')
        );
    });

    it('collects an animated crypto-psbt UR before handling it', async () => {
        const frames = psbtFrames(120);
        expect(frames.length).toBeGreaterThan(2);

        await mount();
        await scan(frames[0]);

        expect(mockHandleAnything).not.toHaveBeenCalled();
        expect(camera().props.mode).toBe('BC-UR');
        expect(camera().props.parts).toBe(1);
        expect(camera().props.totalParts).toBe(frames.length);

        // A repeated frame is ignored.
        await scan(frames[0]);
        expect(camera().props.parts).toBe(1);

        for (const frame of frames.slice(1)) await scan(frame);

        expect(mockHandleAnything).toHaveBeenCalledTimes(1);
        expect(mockHandleAnything).toHaveBeenCalledWith(
            PSBT_BYTES.toString('base64')
        );
    });

    it('turns a bytes UR into its UTF-8 text', async () => {
        await mount();
        await scan(BYTES_UR);

        expect(mockHandleAnything).toHaveBeenCalledWith('hello from a UR');
    });

    it('drops a malformed UR and accepts the next scan', async () => {
        const navigation = await mount();
        await scan(MALFORMED_ACCOUNT_UR);

        expect(mockHandleAnything).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
        expect(camera().props.parts).toBe(0);

        await scan(BYTES_UR);
        expect(mockHandleAnything).toHaveBeenCalledWith('hello from a UR');
    });
});
