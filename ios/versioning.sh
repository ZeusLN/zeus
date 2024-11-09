#!/bin/bash

cd "$SRCROOT"

sed -i -e "/BUILD_NUMBER =/ s/= .*/= $(date +"%Y%m%d%H%M")/" Config.xcconfig

rm Config.xcconfig-e