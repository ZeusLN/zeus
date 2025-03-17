VERSION=v0.18.5-beta-zeus.swaps.1

ANDROID_FILE=Lndmobile.aar
IOS_FILE=Lndmobile.xcframework

ANDROID_SHA256='192bf808538705a2320b9b5656f6ea8f562065b8d7120ad36326ee35292ce7fc'
IOS_SHA256='d188ac67654087aba6826620e1c9686d394c55646bda00d6b26a2ae01bc39f28'

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

###########
# Android #
###########

if ! echo "$ANDROID_SHA256 android/lndmobile/$ANDROID_FILE" | sha256sum -c -; then
    echo "Android library file missing or checksum failed" >&2

    # delete old instance of library file
    rm android/lndmobile/$ANDROID_FILE

    # download Android LND library file
    curl -L $ANDROID_LINK > android/lndmobile/$ANDROID_FILE

    # check checksum
    if ! echo "$ANDROID_SHA256 android/lndmobile/$ANDROID_FILE" | sha256sum -c -; then
        echo "Android checksum failed" >&2
        exit 1
    fi
fi

#######
# iOS #
#######

mkdir ios/LndMobileLibZipFile

if ! echo "$IOS_SHA256 ios/LndMobileLibZipFile/$IOS_FILE.zip" | sha256sum -c -; then
    echo "iOS library file missing or checksum failed" >&2

    # delete old instance of library file
    rm ios/LndMobileLibZipFile/$IOS_FILE.zip

    # download iOS LND library file
    curl -L $IOS_LINK > ios/LndMobileLibZipFile/$IOS_FILE.zip

    # check checksum
    if ! echo "$IOS_SHA256 ios/LndMobileLibZipFile/$IOS_FILE.zip" | sha256sum -c -; then
        echo "iOS checksum failed" >&2
        exit 1
    fi
fi

# delete old instances of library files
rm -rf ios/LncMobile/$IOS_FILE

# unzip LND library file
unzip ios/LndMobileLibZipFile/$IOS_FILE.zip -d ios/LncMobile
