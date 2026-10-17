import Long from 'long';

import { lnrpc } from '../proto/lightning';
import BaseModel from './BaseModel';

describe('BaseModel', () => {
    it('converts Longs to strings', () => {
        const model: any = new BaseModel({
            signed: Long.fromValue('-9007199254740993'),
            unsigned: Long.fromValue('18446744073709551615', true),
            zero: Long.fromNumber(0)
        });
        expect(model.signed).toBe('-9007199254740993');
        expect(model.unsigned).toBe('18446744073709551615');
        expect(model.zero).toBe('0');
    });

    it('converts the Longs of a decoded protobuf message', () => {
        const decoded = lnrpc.Peer.decode(
            lnrpc.Peer.encode({ bytes_sent: Long.fromNumber(1000) }).finish()
        );
        const model: any = new BaseModel(decoded);
        expect(model.bytes_sent).toBe('1000');
    });

    // the app bundle holds two: protobufjs requires the UMD build of long,
    // the app imports the ESM one
    it('converts the Longs of another copy of the library', () => {
        let OtherLong: any;
        jest.isolateModules(() => {
            OtherLong = require('long');
        });
        const other = OtherLong.fromNumber(0);
        expect(other).not.toBeInstanceOf(Long);
        expect((new BaseModel({ other }) as any).other).toBe('0');
    });

    it('keeps every other value as it is', () => {
        const data = {
            string: 'a',
            number: 1,
            zero: 0,
            boolean: false,
            nothing: null,
            missing: undefined,
            list: [1, 2],
            object: { a: 1 }
        };
        expect({ ...new BaseModel(data) }).toEqual(data);
    });

    it('does not take parsed JSON that is shaped like a Long for one', () => {
        const data = JSON.parse(
            `{
                "shape": { "leaf": "a", "high": 0, "low": 0 },
                "full": { "high": 0, "low": 1, "unsigned": false },
                "flagged": { "high": 0, "low": 0, "__isLong__": true },
                "noToString": { "high": 0, "low": 0, "toString": 0 }
            }`
        );
        expect({ ...new BaseModel(data) }).toEqual(data);
    });
});
