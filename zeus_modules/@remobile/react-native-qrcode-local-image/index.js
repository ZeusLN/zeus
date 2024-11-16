const ReactNative = require("react-native");
const NativeModules = ReactNative.NativeModules;
const QRCodeLocalImage = NativeModules.QRCodeLocalImage;

const QRCodeReader = {
  /**
   * @public
   * Decode a QR code an call back with results, or errors.
   *
   * @param {String} path - An image path to open & search for QR code presence/content.
   * @param {Function} callback - A callback in form of `(error, results)`.
   * @return {void}
   */
  decode: function(path, callback) {
    console.log(NativeModules);
    QRCodeLocalImage.decode(path, callback);
  }
};

module.exports = QRCodeReader;
