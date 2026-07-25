import { expect } from 'chai';
import debug from 'debug';

import { Logger, LogLevel } from '../lib/util/log';

describe('util/log', () => {
    const captured: string[] = [];
    const originalLog = debug.log;

    before(() => {
        debug.enable('testns');
        debug.log = (...args: any[]) => {
            captured.push(args.map(String).join(' '));
        };
    });

    after(() => {
        debug.disable();
        debug.log = originalLog;
    });

    beforeEach(() => captured.splice(0));

    it('logs messages at or above its level with a level prefix', () => {
        const logger = new Logger(LogLevel.info, 'testns');
        logger.info('hello');
        logger.error('boom');
        expect(captured).to.have.length(2);
        expect(captured[0]).to.contain('[info] hello');
        expect(captured[1]).to.contain('[error] boom');
    });

    it('suppresses messages below its level', () => {
        const logger = new Logger(LogLevel.warn, 'testns');
        logger.debug('quiet');
        logger.info('also quiet');
        logger.warn('loud');
        expect(captured).to.have.length(1);
        expect(captured[0]).to.contain('[warn] loud');
    });

    it('passes additional arguments through to the debugger', () => {
        const logger = new Logger(LogLevel.debug, 'testns');
        logger.debug('payload:', { a: 1 });
        expect(captured).to.have.length(1);
        expect(captured[0]).to.contain('[debug] payload:');
    });

    it('fromEnv defaults to logging nothing', () => {
        const logger = Logger.fromEnv('testns');
        logger.error('should not appear');
        expect(captured).to.have.length(0);
    });
});
