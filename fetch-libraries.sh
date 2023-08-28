VERSION=v0.17.0-beta.rc1-zeus

ANDROID_FILE=Lndmobile.aar
IOS_FILE=Lndmobile.xcframework

ANDROID_SHA256='929ac1fe51f63ecb6e531af9d388ca1b722a571c088c6ecabf43f3bd12642992'
IOS_SHA256='55c424348a6151ccf3751efe68c0c34b398ba55ed8d37b0760ab78abd48895d9'

FILE_PATH=https://github.com/ZeusLN/lnd/releases/download/$VERSION/

ANDROID_LINK=$FILE_PATH$ANDROID_FILE
IOS_LINK=$FILE_PATH$IOS_FILE.zip

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
rm android/lndmobile/$ANDROID_FILE
rm -rf ios/LncMobile/$IOS_FILE

# create temp dir
mkdir tmp

# download LND library files
curl -L $ANDROID_LINK > tmp/$ANDROID_FILE
curl -L $IOS_LINK > tmp/$IOS_FILE.zip

# check checksums
if ! echo "$ANDROID_SHA256 tmp/$ANDROID_FILE" | sha256sum -c -; then
    echo "Android checksum failed" >&2
    exit 1
fi

if ! echo "$IOS_SHA256 tmp/$IOS_FILE.zip" | sha256sum -c -; then
    echo "iOS checksum failed" >&2
    exit 1
fi

# unzip LND library files
unzip tmp/$IOS_FILE.zip -d tmp/

# move LND library files into place
mv tmp/$ANDROID_FILE android/lndmobile/$ANDROID_FILE
mv tmp/$IOS_FILE ios/LncMobile/$IOS_FILE

# delete temp dir
rm -rf tmp