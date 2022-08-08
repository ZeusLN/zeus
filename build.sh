#!/bin/bash
set -x
PASS_FILE="android/app/olympus_keystore.pass"
KEYSTORE_FILE="android/app/olympus.pfx"
ALIAS="olympus"

ZEUS_PATH=/olympus/zeus

# Check we have the password.
if [ -f $PASS_FILE ]; then
    KEYSTORE_PASS=$(cat magen_keystore.pass);
else
    KEYSTORE_PASS=$(head -c 32 /dev/urandom | sha256sum | head -c 64);
    echo $KEYSTORE_PASS > $PASS_FILE;
fi

# Check we have the keystore.
if [ ! -f $KEYSTORE_FILE ]; then
#    keytool -genkey -alias $ALIAS -keystore $KEYSTORE_FILE -storetype PKCS12 -keyalg RSA -keysize 4096 -storepass $KEYSTORE_PASS -keypass $KEYSTORE_PASS -validity 10000 -dname CN=IL;
    keytool -genkeypair -alias $ALIAS -keystore $KEYSTORE_FILE -v -storetype PKCS12 -keyalg RSA -keysize 2048 -storepass $KEYSTORE_PASS -keypass $KEYSTORE_PASS -validity 10000
fi

ZEUS_KEY_PASSWORD=$ZEUS_STORE_PASSWORD

KEYSTORE_FILE="$ZEUS_PATH/$KEYSTORE_FILE"

docker build . -t zeus_builder_image

docker run --name zeus_builder_container -v `pwd`:$ZEUS_PATH zeus_builder_image bash -c \
    "cd /olympus/zeus/android && \
    ZEUS_KEYSTORE_PATH=$KEYSTORE_FILE \
    ZEUS_KEY_PASSWORD=$KEYSTORE_PASS \
    ZEUS_STORE_PASSWORD=$KEYSTORE_PASS \
    ZEUS_KEY_ALIAS=$ALIAS \
    ZEUS_DEBUG_KEYSTORE_PATH=dummy \
    ZEUS_DEBUG_STORE_PASSWORD=dummy \
    ZEUS_DEBUG_KEY_ALIAS=dummy \
    ZEUS_DEBUG_KEY_PASSWORD=dummy \
    ./gradlew assembleDebug && \
    cp ./app/build/outputs/apk/debug/zeus-debug.apk ../";