const userFriendlyErrors: any = {
  '11':
    "The person you're trying to connect to isn't available or rejected the connection.\
  Their public key may have changed or the server may no longer be responding.",
  '3':
    "Can't find a route to make this payment on the Lightning network.\
  Try to open a channel directly to the destination or find another route.",
};

class ErrorUtils {
    errorToUserFriendly = (error: string) => userFriendlyErrors[error] || error;
}

const errorUtils = new ErrorUtils();
export default errorUtils;