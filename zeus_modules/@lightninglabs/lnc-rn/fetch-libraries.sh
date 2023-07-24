VERSION=v0.2.5-alpha

ANDROID_ZIP_NAME=lnc-$VERSION-android.zip
IOS_ZIP_NAME=lnc-$VERSION-ios.zip

ZIP_PATH=https://github.com/lightninglabs/lightning-node-connect/releases/download/$VERSION/

ANDROID_ZIP_LINK=$ZIP_PATH$ANDROID_ZIP_NAME
IOS_ZIP_LINK=$ZIP_PATH$IOS_ZIP_NAME

# test that curl and unzip are installed
if ! command -v curl &> /dev/null
then
    echo "curl could not be found. Please install it and run the script again."
    exit
fi

if ! command -v unzip &> /dev/null
then
    echo "unzip could not be found. Please install it and run the script again."
    exit
fi

# delete old instances of library files
rm -rf android/libs/
rm -rf ios/Lncmobile.xcframework/

# create temp dir
mkdir tmp

# download LNC library files
curl -L $ANDROID_ZIP_LINK > tmp/android.zip
curl -L $IOS_ZIP_LINK > tmp/ios.zip

# unzip LNC library files
unzip tmp/android.zip -d tmp/
unzip tmp/ios.zip -d tmp/

# move LNC library files into place
mkdir -p android/libs/
mv tmp/android/* android/libs/
mv tmp/ios/* ios/

# delete temp dir
rm -rf tmp