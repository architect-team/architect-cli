#!/usr/bin/env bash

# Setup Architect home directory
ARCHITECT_PATH=$HOME/.architect
mkdir -p ${ARCHITECT_PATH}
grep -q -x -F "export ARCHITECT_PATH=${ARCHITECT_PATH}" ~/.bashrc || echo "export ARCHITECT_PATH=${ARCHITECT_PATH}" >> ~/.bashrc

# Hack to allow GRPC to be used as part of the launcher and inside
# the *_pb.js files
npm install -g grpc
npm link grpc --local

# Check to see if GRPC and protoc has been installed
protoc --version
if [[ $? -ne 0 ]]; then
  echo "Protoc compiler not installed. Please make sure to download the correct version for your OS:"
  echo "https://github.com/protocolbuffers/protobuf/releases"
fi
