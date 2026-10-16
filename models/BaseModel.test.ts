import { computed, isObservableProp, observable } from 'mobx';

import BaseModel from './BaseModel';
import Channel from './Channel';

// Guards the Babel class-properties ordering in babel.config.js: if the
// transform runs before TypeScript strips type-only fields, `label` below is
// re-declared after super() and the constructor-assigned value is wiped.
class Sample extends BaseModel {
    label: string;
    @observable active: boolean;
    @observable count = 1;

    @computed get summary(): string {
        return `${this.label}:${this.count}`;
    }
}

describe('BaseModel subclasses', () => {
    it('keep type-only fields assigned by the BaseModel constructor', () => {
        const sample = new Sample({ label: 'alpha', active: true });
        expect(sample.label).toBe('alpha');
        expect(sample.summary).toBe('alpha:1');
    });

    it('keep @observable fields observable', () => {
        const sample = new Sample({ label: 'alpha', active: true });
        expect(sample.active).toBe(true);
        expect(isObservableProp(sample, 'active')).toBe(true);
        expect(isObservableProp(sample, 'count')).toBe(true);
    });

    it('hydrate a real model', () => {
        const channel = new Channel({
            chan_id: '123',
            active: true,
            local_balance: '5000'
        });
        expect(channel.channelId).toBe('123');
        expect(channel.isActive).toBe(true);
        expect(channel.localBalance).toBe('5000');
    });
});
