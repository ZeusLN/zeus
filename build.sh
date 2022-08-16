#!/bin/bash
BUILDER_IMAGE="reactnativecommunity/react-native-android:latest"
CONTAINER_NAME="zeus_builder_container"
ZEUS_PATH=/olympus/zeus

KEYSTORE_FILE=zeus.keystore
KEYSTORE_PASS=zeus1234
ALIAS=zeus

docker run --rm --name $CONTAINER_NAME -v `pwd`:$ZEUS_PATH $BUILDER_IMAGE bash -c \
     'echo -e "\n\n********************************\n*** Building Zeus...\n********************************\n" && \
      cd /olympus/zeus ; yarn install && \
      cd /olympus/zeus/android ; ./gradlew assembleRelease && \

      echo -e "\n\n********************************\n*** Installing signing tools...\n********************************\n" && \
      apt-get update && apt-get install -y apksigner && \

      echo -e "\n\n********************************\n**** Signing apks...\n********************************\n" && \
      cd /olympus/zeus && \
      keytool -delete -noprompt -alias '"${ALIAS}"' -keystore '"$KEYSTORE_FILE"' -storepass '"$KEYSTORE_PASS"' ; \
      keytool -genkeypair -alias '"$ALIAS"' -keystore '"$KEYSTORE_FILE"' -v -storetype PKCS12 -keyalg RSA -keysize 2048 -storepass '"$KEYSTORE_PASS"' -keypass '"$KEYSTORE_PASS"' -validity 10000 -dname "cn=Unknown, ou=Unknown, o=Unknown, c=Unknown" && \
      for f in /olympus/zeus/android/app/build/outputs/apk/release/*.apk;
      do
	java -jar /usr/bin/apksigner sign -v --ks '"$KEYSTORE_FILE"' --ks-key-alias '"$ALIAS"' --ks-pass pass:'"$KEYSTORE_PASS"' --key-pass pass:'"$KEYSTORE_PASS"' $f
	mv $f $(echo $f | sed -e "s/app-/zeus-/" | sed -e "s/-release-unsigned//")
      done && \
 
      echo -e "\n*** Done. Zeus signed apks:\n" && \
      find /olympus/zeus/android/app/build/outputs/apk/release | grep "\.apk" | sed -e "s/\/olympus\/zeus\///" && \

      echo -e "\n\n********************************\n**** MD5\n********************************\n" && \
      md5sum /olympus/zeus/android/app/build/outputs/apk/release/*.apk;';

