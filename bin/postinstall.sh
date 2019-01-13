#!/usr/bin/env bash

# Check to see if GRPC and protoc has been installed
protoc --version
if [[ $? -ne 0 ]]; then
  echo "Please follow instructions below to install GRPC from source:"
  echo "https://github.com/grpc/grpc/blob/master/BUILDING.md"
  exit 1
fi

# Setup Architect home directory
mkdir -p $HOME/.architect
grep -q -x -F 'export ARCHITECT_PATH=$HOME/.architect' ~/.bashrc || echo 'export ARCHITECT_PATH=$HOME/.architect' >> ~/.bashrc
