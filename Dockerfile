FROM ubuntu:16.04
LABEL maintainer = "david.thor@architect.io"

# Install Node.js & Python
RUN apt-get update && \
  apt-get install -y build-essential autoconf libtool pkg-config curl git sudo unzip python-pip && \
  pip install --upgrade pip && \
  curl -sL https://deb.nodesource.com/setup_10.x -o nodesource_setup.sh && \
  bash ./nodesource_setup.sh && \
  apt-get install -y nodejs

# Setup Architect home directory
ARG ARCHITECT_PATH=/root/.architect
RUN mkdir -p ${ARCHITECT_PATH} && \
  grep -q -x -F "export ARCHITECT_PATH=${ARCHITECT_PATH}" ~/.bashrc || echo "export ARCHITECT_PATH=${ARCHITECT_PATH}" >> ~/.bashrc

# Install GRPC
RUN git clone -b $(curl -L https://grpc.io/release) https://github.com/grpc/grpc ${ARCHITECT_PATH}/grpc --recursive && \
  cd ${ARCHITECT_PATH}/grpc/ && \
  make && \
  cd ${ARCHITECT_PATH}/grpc/third_party/protobuf && \
  make install


