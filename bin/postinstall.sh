#!/usr/bin/env bash

# Setup Architect home directory
ARCHITECT_PATH=$HOME/.architect
mkdir -p ${ARCHITECT_PATH}
grep -q -x -F 'export ARCHITECT_PATH=$ARCHITECT_PATH' ~/.bashrc || echo 'export ARCHITECT_PATH=$ARCHITECT_PATH' >> ~/.bashrc

# Check to see if GRPC and protoc has been installed
protoc --version
if [[ $? -ne 0 ]]; then
  echo "protoc not installed. Installing now..."
  git clone -b $(curl -L https://grpc.io/release) https://github.com/grpc/grpc ${ARCHITECT_PATH}/grpc --recursive
  cd ${ARCHITECT_PATH}/grpc/
  make
  protoc --version
  if [[ $? -ne 0 ]]; then
    echo "Unable to install protoc. Please follow instructions below to install GRPC from source:"
    echo "https://github.com/grpc/grpc/blob/master/BUILDING.md"
    exit 1
  fi
fi

# Hack to allow GRPC to be used as part of the launcher and inside
# the *_pb.js files
npm install -g grpc
npm link grpc
