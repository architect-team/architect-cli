#!/usr/bin/env bash

# Setup Architect home directory
ARCHITECT_PATH=$HOME/.architect
mkdir -p ${ARCHITECT_PATH}
export ARCHITECT_PATH=${ARCHITECT_PATH}
grep -q -x -F "export ARCHITECT_PATH=${ARCHITECT_PATH}" ~/.bashrc || echo "export ARCHITECT_PATH=${ARCHITECT_PATH}" >> ~/.bashrc

# Hack to allow GRPC to be used as part of the launcher and inside
# the *_pb.js files
npm install -g grpc
npm link grpc --local

# Check to see if GRPC and protoc has been installed
if ! [[ -x "$(command -v protoc)" ]]; then
  echo "GRPC must be built from source. This may take some time."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sudo xcode-select --install

    # Check if homebrew is installed
    if ! [[ -x "$(command -v brew)" ]]; then
      read -p "Homebrew was not detected and is required to install GRPC dependencies. Would you like to install it now? [y/n]" -n 1 -r
      echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
      fi
    fi

    brew install autoconf automake libtool shtool
  else
    sudo apt-get install build-essential autoconf libtool pkg-config
  fi

  git clone -b $(curl -L https://grpc.io/release) https://github.com/grpc/grpc ${ARCHITECT_PATH}/grpc --recursive
  cd ${ARCHITECT_PATH}/grpc/
  make HAS_SYSTEM_PROTOBUF=false
  cd ${ARCHITECT_PATH}/grpc/third_party/protobuf
  make install

  if ! [[ -x "$(command -v protoc)" ]]; then
    echo "Unable to install protoc. Please follow instructions below to install GRPC from source:"
    echo "https://github.com/grpc/grpc/blob/master/BUILDING.md"
    exit 1
  fi
fi
