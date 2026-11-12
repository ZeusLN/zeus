import { TEST_IDS } from '../../utils/TestIds';
import { byId } from '../helpers/elements';

// Options are keyed by the screen they open or the action they run, such as
// SetPin or DeletePin.
class SecurityScreen {
    option(screenOrAction: string) {
        return byId(TEST_IDS.security.option(screenOrAction));
    }
}

export default new SecurityScreen();
