import { expect } from 'chai';
import { subscriptionMethods } from '@lightninglabs/lnc-core';

import { createRpc } from '../lib/api/createRpc';

const lowerFirst = (s: string) => s[0].toLowerCase() + s.slice(1);

interface Call {
    type: 'request' | 'subscribe';
    method: string;
    request: object;
}

describe('api/createRpc', () => {
    const calls: Call[] = [];
    const fakeLnc: any = {
        request: async (method: string, request: object) => {
            calls.push({ type: 'request', method, request });
            return { ok: true };
        },
        subscribe: (method: string, request: object) => {
            calls.push({ type: 'subscribe', method, request });
            return 'sub-token';
        }
    };

    beforeEach(() => calls.splice(0));

    it('routes unary methods to lnc.request with the capitalized name', async () => {
        const rpc = createRpc<any>('lnrpc.Lightning', fakeLnc);
        const request = { field: 'value' };
        const result = await rpc.getInfo(request);
        expect(result).to.deep.equal({ ok: true });
        expect(calls).to.have.length(1);
        expect(calls[0].type).to.equal('request');
        expect(calls[0].method).to.equal('lnrpc.Lightning.GetInfo');
        expect(calls[0].request).to.equal(request);
    });

    it('routes streaming methods to lnc.subscribe', () => {
        // use a real entry from lnc-core's subscriptionMethods list so the
        // test tracks the source of truth for streaming-method routing
        const full = subscriptionMethods[0];
        const parts = full.split('.');
        const methodName = parts.pop() as string;
        const packageName = parts.join('.');

        const rpc = createRpc<any>(packageName, fakeLnc);
        const token = rpc[lowerFirst(methodName)]({});
        expect(token).to.equal('sub-token');
        expect(calls).to.have.length(1);
        expect(calls[0].type).to.equal('subscribe');
        expect(calls[0].method).to.equal(full);
    });

    it('treats every entry in subscriptionMethods as streaming', () => {
        for (const full of subscriptionMethods) {
            calls.splice(0);
            const parts = full.split('.');
            const methodName = parts.pop() as string;
            const packageName = parts.join('.');

            const rpc = createRpc<any>(packageName, fakeLnc);
            rpc[lowerFirst(methodName)]({});
            expect(calls[0].type).to.equal('subscribe');
            expect(calls[0].method).to.equal(full);
        }
    });
});
