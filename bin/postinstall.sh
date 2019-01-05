#!/usr/bin/env bash

# Check to see if GRPC and protoc has been installed
echo $PWD
protoc --version
if [[ $? -ne 0 ]]; then
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
grep -q -x -F "export NODE_PATH=" ~/.bashrc || echo "export NODE_PATH=${NODE_PATH}" >> ~/.bashrc
npm install -g grpc
ln -s ${NODE_PATH}/grpc ./node_modules
ln -s ${NODE_PATH}/grpc ./launchers/nodejs/node_modules
