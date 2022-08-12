#!/bin/bash
set -x
IMAGE_NAME="zeus_builder_image"
CONTAINER_NAME="zeus_builder_container"
ZEUS_PATH=/olympus/zeus

docker build -t $IMAGE_NAME .

docker run --name $CONTAINER_NAME -v `pwd`:$ZEUS_PATH $IMAGE_NAME bash -c \
     "cd /olympus/zeus && \
      npm install && \
      cd /olympus/zeus/android && \
      ./gradlew --debug assembleRelease && \
      cp ./app/build/outputs/apk/debug/zeus-release.apk ../";

docker container rm $CONTAINER_NAME