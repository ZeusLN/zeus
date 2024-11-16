# React Native QRCodeLocalImage (remobile)
A local qrcode image parse for react-native, support for ios and android

## Installation
```sh
npm install @remobile/react-native-qrcode-local-image --save
```
### Installation (iOS)
* Drag RCTQRCodeLocalImage.xcodeproj to your project on Xcode.
* Click on your main project file (the one that represents the .xcodeproj) select Build Phases and drag libRCTQRCodeLocalImage.a from the Products folder inside the RCTQRCodeLocalImage.xcodeproj.
* Look for Header Search Paths and make sure it contains $(SRCROOT)/../../../react-native/React as recursive.

### Installation (Android)
```gradle
...
include ':react-native-qrcode-local-image'
project(':react-native-qrcode-local-image').projectDir = new File(settingsDir, '../node_modules/@remobile/react-native-qrcode-local-image/android')
```

* In `android/app/build.gradle`

```gradle
...
dependencies {
    ...
    compile project(':react-native-qrcode-local-image')
}
```

* register module (in MainApplication.java)

```java
......
import com.remobile.qrcodeLocalImage.RCTQRCodeLocalImagePackage;  // <--- import

......

@Override
protected List<ReactPackage> getPackages() {
   ......
   new RCTQRCodeLocalImagePackage()              // <------ add here
   ......
}

```

## Usage

### Example
```js
'use strict';

var React = require('react');
var ReactNative = require('react-native');
var {
    StyleSheet,
    View,
    Text,
} = ReactNative;

var Button = require('@remobile/react-native-simple-button');
var QRCode = require('@remobile/react-native-qrcode-local-image');


module.exports = React.createClass({
    getInitialState() {
        return {text: ''}
    },
    onPress() {
        QRCode.decode(!app.isandroid?'/Users/fang/Desktop/qr.png':'/sdcard/qr.png', (error, result)=>{
            this.setState({text: JSON.stringify({error, result})});
        });
    },
    render() {
        return (
            <View style={styles.container}>
                <Button onPress={this.onPress}>测试</Button>
                <Text>
                    {this.state.text}
                </Text>
            </View>
        );
    }
});


var styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'space-around',
        paddingVertical: 150,
    },
});
```

### method
- `decode(path, callback)` path canbe local image or url


### see detail use
* https://github.com/remobile/react-native-template
