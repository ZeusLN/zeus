import { observable, computed } from 'mobx';
import BaseModel from './BaseModel';

export default class Peer extends BaseModel {
    @observable public pubkey: string;
    @observable public address: string;
    @observable public alias: string;
    @observable public ping_time: number;
    @observable public sats_sent: number;
    @observable public sats_recv: number;
    @observable public connected: boolean;
    @observable public num_channels: number;

    constructor(data: any) {
        super(data);
        this.pubkey = data.pubkey ?? data.pub_key ?? data.id;
        this.address = data.address ?? data.netaddr?.join(', ');
        this.alias = data.alias;
        this.ping_time = data.ping_time;
        this.sats_sent = data.sat_sent ?? data.sats_sent;
        this.sats_recv = data.sat_recv ?? data.sats_recv;
        this.connected = data.connected;
        this.num_channels = data.num_channels;
    }

    @computed public get model(): string {
        return 'Peer';
    }
}
