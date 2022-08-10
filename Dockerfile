FROM reactnativecommunity/react-native-android:latest
ARG tag_name=master

WORKDIR /olympus

RUN git clone --depth 1 --branch ${tag_name} https://github.com/ZeusLN/zeus.git
WORKDIR /olympus/zeus
RUN npm install

CMD /bin/bash