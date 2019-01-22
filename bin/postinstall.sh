#!/usr/bin/env bash

# Set protoc version to install
PROTOC_VERSION='3.6.1'
PROTOC_DOWNLOAD_LINK='https://github.com/protocolbuffers/protobuf/releases/download/v3.6.1'

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
  echo "Protoc compiler not found. Attempting to install."

  # Detect system architecture
  ARCHITECTURE=$(uname -m)
  if [[ ${ARCHITECTURE} -ne 'x86_64' ]]; then
    ARCHITECTURE='x86_32'
  fi

  # Detect operating system
  OS='linux'
  if [[ "$OSTYPE" == "darwin"* ]]; then
    OS='osx'
  elif [[ "$OSTYPE" == "win32" ]]; then
    OS='win32'
  fi

  # Download protoc binary and add symlink in path
  curl ${PROTOC_DOWNLOAD_LINK}/protoc-${PROTOC_VERSION}-${OS}-${ARCHITECTURE}.zip -L -o ${ARCHITECT_PATH}/protoc.zip
  mkdir ${ARCHITECT_PATH}/protoc/
  unzip ${ARCHITECT_PATH}/protoc.zip -d ${ARCHITECT_PATH}/protoc/
  sudo ln -s ${ARCHITECT_PATH}/protoc/bin/protoc /usr/local/bin/
  protoc --version
  echo "Unable to install protoc compiler. Please install manually:"
  echo "https://github.com/protocolbuffers/protobuf/releases"
fi
