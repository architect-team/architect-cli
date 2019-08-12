#!/bin/sh

echoerr() { echo "$@" 1>&2; }

# Setup Architect home directory
ARCHITECT_PATH=$HOME/.architect
mkdir -p ${ARCHITECT_PATH}
export ARCHITECT_PATH=${ARCHITECT_PATH}
grep -q -x -F "export ARCHITECT_PATH=${ARCHITECT_PATH}" ~/.bashrc || echo "export ARCHITECT_PATH=${ARCHITECT_PATH}" >> ~/.bashrc

# Pull docker image used to build GRPC clients
docker pull architectio/protoc-all
