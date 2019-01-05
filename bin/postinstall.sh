#!/usr/bin/env bash

# Check to see if GRPC and protoc has been installed
protoc --version
if [[ $? -eq 0 ]]; then
  echo "Please follow instructions below to install GRPC from source:"
  echo "https://github.com/grpc/grpc/blob/master/BUILDING.md"
  exit 1
fi

# Setup Architect home directory
mkdir -p $HOME/.architect
grep -q -x -F 'export ARCHITECT_PATH=$HOME/.architect' ~/.bashrc || echo 'export ARCHITECT_PATH=$HOME/.architect' >> ~/.bashrc

# Install dependencies for nodejs launcher
npm install --prefix ./launchers/nodejs/

# Install relative copy of GRPC for Node
NODE_PATH="$(npm root -g)"
npm install -g grpc
npm install -g google-protobuf
unlink ./node_modules/grpc
unlink ./launchers/nodejs/node_modules/grpc
ln -s ${NODE_PATH}/grpc ./node_modules
ln -s ${NODE_PATH}/grpc ./launchers/nodejs/node_modules
