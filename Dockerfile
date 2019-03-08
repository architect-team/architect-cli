FROM ubuntu:18.04
LABEL maintainer = "david.thor@architect.io"

# Install Node.js & Python
RUN apt-get update && \
  apt-get install -y build-essential autoconf libtool pkg-config curl git sudo unzip python-pip && \
  pip install --upgrade pip && \
  curl -sL https://deb.nodesource.com/setup_10.x -o nodesource_setup.sh && \
  bash ./nodesource_setup.sh && \
  apt-get install -y nodejs

# Install Docker
RUN curl -sSL https://get.docker.com/ | sh

# Setup Architect home directory
ARG ARCHITECT_PATH=/root/.architect
RUN mkdir -p ${ARCHITECT_PATH} && \
  grep -q -x -F "export ARCHITECT_PATH=${ARCHITECT_PATH}" ~/.bashrc || echo "export ARCHITECT_PATH=${ARCHITECT_PATH}" >> ~/.bashrc


