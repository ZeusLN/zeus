import { TEST_IDS } from '../../utils/TestIds';
import { byId } from '../helpers/elements';

const IDS = TEST_IDS.security;

// Options are keyed by the screen they open or the action they run, such as
// SetPin or DeletePin.
class SecurityScreen {
    option(screenOrAction: string) {
        return byId(IDS.option(screenOrAction));
    }

    // Listed only while the device has Face ID or Touch ID enrolled.
    get biometricsSwitch() {
        return byId(IDS.biometricsSwitch);
    }

    // Listed only once a PIN is set.
    get scramblePinSwitch() {
        return byId(IDS.scramblePinSwitch);
    }

    // Listed only once a PIN, a password or biometrics is set.
    get loginBackgroundSwitch() {
        return byId(IDS.loginBackgroundSwitch);
    }
}

export default new SecurityScreen();
