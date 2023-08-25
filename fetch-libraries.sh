VERSION=v0.16.4-beta-zeus

ANDROID_FILE=Lndmobile.aar
IOS_FILE=Lndmobile.xcframework

ANDROID_SHA256='0d95ef47f057c5d1a4722261d79da5beee55c9d9100c63743027f01a2ba9aea0'
IOS_SHA256='f350ef9587f326fd38a33f4a31c36a52e3b7b013058cd9ac0b6c249f761308eb'

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