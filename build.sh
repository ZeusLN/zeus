#!/bin/bash
BUILDER_IMAGE="reactnativecommunity/react-native-android:latest"
CONTAINER_NAME="zeus_builder_container"
ZEUS_PATH=/olympus/zeus

docker run --rm --name $CONTAINER_NAME -v `pwd`:$ZEUS_PATH $BUILDER_IMAGE bash -c \
     "cd /olympus/zeus && \
      yarn install && \
      cd /olympus/zeus/android && \
      ./gradlew assembleRelease && \
      cd /olympus/zeus ; find android/app/build/outputs/apk/release | grep app-";
