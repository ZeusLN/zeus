import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.mintDiscovery;

export type MintDiscoveryMode = 'zeus' | 'all' | 'custom' | 'later';

class MintDiscoveryScreen {
    option(mode: MintDiscoveryMode) {
        return byId(IDS.option(mode));
    }

    get npubInput() {
        return byId(IDS.npubInput);
    }

    get npubError() {
        return byId(IDS.npubError);
    }

    get fetchMintsButton() {
        return byId(IDS.fetchMintsButton);
    }

    get selectButton() {
        return byId(IDS.selectButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.option('zeus'));
    }

    async choose(mode: MintDiscoveryMode): Promise<void> {
        await this.option(mode).tap();
    }
}

export default new MintDiscoveryScreen();
