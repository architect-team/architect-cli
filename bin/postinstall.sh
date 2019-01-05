#!/usr/bin/env bash

# Setup Architect home directory
mkdir -p $HOME/.architect
grep -q -x -F 'export ARCHITECT_PATH=$HOME/.architect' ~/.bashrc || echo 'export ARCHITECT_PATH=$HOME/.architect' >> ~/.bashrc

# Install relative copy of GRPC for Node
NODE_PATH="$(npm root -g)"
npm install -g grpc
unlink ./node_modules/grpc
unlink ./launchers/nodejs/node_modules/grpc
ln -s ${NODE_PATH}/grpc ./node_modules
ln -s ${NODE_PATH}/grpc ./launchers/nodejs/node_modules
