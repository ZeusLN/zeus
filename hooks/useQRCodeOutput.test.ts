jest.mock('react-native-vision-camera', () => ({
    useObjectOutput: jest.fn((options) => options),
    // Same check as the library's isScannedCode (lib/isScannedObject.js),
    // which Jest cannot load untransformed.
    isScannedCode: (object: object) => 'value' in object
}));

jest.mock('react-native-vision-camera-barcode-scanner', () => ({
    useBarcodeScannerOutput: jest.fn((options) => options)
}));

import { renderHook } from '@testing-library/react-native';
import { useObjectOutput } from 'react-native-vision-camera';
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner';

import useQRCodeOutputIOS from './useQRCodeOutput.ios';
// Jest resolves the bare path to the .ios variant, so load the Android
// implementation by its full filename.
const useQRCodeOutputAndroid: (onScanned: (value: string) => void) => any =
    require('./useQRCodeOutput.ts').default;

const mockUseObjectOutput = useObjectOutput as jest.Mock;
const mockUseBarcodeScannerOutput = useBarcodeScannerOutput as jest.Mock;

describe('useQRCodeOutput (iOS)', () => {
    beforeEach(() => mockUseObjectOutput.mockClear());

    const scan = async (objects: object[]) => {
        const onScanned = jest.fn();
        await renderHook(() => useQRCodeOutputIOS(onScanned));
        mockUseObjectOutput.mock.lastCall[0].onObjectsScanned(objects);
        return onScanned;
    };

    it('scans QR codes only, with a stable types array', async () => {
        const { rerender } = await renderHook(() =>
            useQRCodeOutputIOS(jest.fn())
        );
        await rerender({});
        const [first, second] = mockUseObjectOutput.mock.calls;
        expect(first[0].types).toEqual(['qr']);
        expect(second[0].types).toBe(first[0].types);
    });

    it('forwards the first code that has a value', async () => {
        const onScanned = await scan([
            { type: 'face', faceID: 1 },
            { type: 'qr', value: undefined },
            { type: 'qr', value: 'lnbc1first' },
            { type: 'qr', value: 'lnbc1second' }
        ]);
        expect(onScanned).toHaveBeenCalledTimes(1);
        expect(onScanned).toHaveBeenCalledWith('lnbc1first');
    });

    it('forwards an empty string value', async () => {
        const onScanned = await scan([{ type: 'qr', value: '' }]);
        expect(onScanned).toHaveBeenCalledWith('');
    });

    it('does nothing when no code has a value', async () => {
        expect(await scan([])).not.toHaveBeenCalled();
        expect(
            await scan([
                { type: 'face', faceID: 1 },
                { type: 'qr', value: undefined }
            ])
        ).not.toHaveBeenCalled();
    });
});

describe('useQRCodeOutput (Android)', () => {
    beforeEach(() => mockUseBarcodeScannerOutput.mockClear());

    const options = async (onScanned = jest.fn()) => {
        await renderHook(() => useQRCodeOutputAndroid(onScanned));
        return mockUseBarcodeScannerOutput.mock.lastCall[0];
    };

    it('scans QR codes at full resolution, with a stable formats array', async () => {
        const { rerender } = await renderHook(() =>
            useQRCodeOutputAndroid(jest.fn())
        );
        await rerender({});
        const [first, second] = mockUseBarcodeScannerOutput.mock.calls;
        expect(first[0].barcodeFormats).toEqual(['qr-code']);
        expect(first[0].outputResolution).toBe('full');
        expect(second[0].barcodeFormats).toBe(first[0].barcodeFormats);
    });

    it('forwards the first barcode with a raw value', async () => {
        const onScanned = jest.fn();
        (await options(onScanned)).onBarcodeScanned([
            { rawValue: undefined },
            { rawValue: 'bitcoin:bc1qfirst' },
            { rawValue: 'bitcoin:bc1qsecond' }
        ]);
        expect(onScanned).toHaveBeenCalledTimes(1);
        expect(onScanned).toHaveBeenCalledWith('bitcoin:bc1qfirst');
    });

    it('does nothing when no barcode has a raw value', async () => {
        const onScanned = jest.fn();
        const { onBarcodeScanned } = await options(onScanned);
        onBarcodeScanned([]);
        onBarcodeScanned([{ rawValue: undefined }]);
        expect(onScanned).not.toHaveBeenCalled();
    });

    it('logs scanner errors instead of throwing', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const error = new Error('analysis failed');
        const { onError } = await options();
        expect(() => onError(error)).not.toThrow();
        expect(spy).toHaveBeenCalledWith('Barcode scanner error:', error);
        spy.mockRestore();
    });
});
