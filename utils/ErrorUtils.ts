const userFriendlyErrors: any = {
    'Error: SOCKS: Connection refused':
        'Host unreachable. Try restarting your node or its Tor process.',
    'Error: SOCKS: Host unreachable':
        'Host unreachable. Try restarting your node or its Tor process.',
    'Error: called `Result::unwrap()` on an `Err` value: BootStrapError("Timeout waiting for bootstrap")':
        'Error starting up Tor on your phone. Try restarting Zeus. If the problem persists consider reinstalling the app.',
    'Error: called `Result::unwrap()` on an `Err` value: BootStrapError("Timeout waiting for boostrap")':
        'Error starting up Tor on your phone. Try restarting Zeus. If the problem persists consider reinstalling the app.'
};

class ErrorUtils {
    errorToUserFriendly = (error: string) => userFriendlyErrors[error] || error;
}

const errorUtils = new ErrorUtils();
export default errorUtils;
