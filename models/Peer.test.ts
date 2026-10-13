jest.mock('../stores/Stores');

import Peer from './Peer';

describe('Peer byte counters', () => {
    it('reads bytes_sent and bytes_recv from LND REST and embedded LND peers', () => {
        const peer = new Peer({ bytes_sent: '1000', bytes_recv: '2000' });
        expect(peer.bytesSent).toBe('1000');
        expect(peer.bytesRecv).toBe('2000');
    });

    it('reads bytesSent and bytesRecv from LNC peers', () => {
        const peer = new Peer({ bytesSent: '300', bytesRecv: '400' });
        expect(peer.bytesSent).toBe('300');
        expect(peer.bytesRecv).toBe('400');
    });

    it('leaves the counters undefined when the backend sends neither', () => {
        const peer = new Peer({ pub_key: '02aa' });
        expect(peer.bytesSent).toBeUndefined();
        expect(peer.bytesRecv).toBeUndefined();
    });
});
