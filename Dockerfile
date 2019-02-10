FROM architectio/architect-cli-base:latest
LABEL maintainer = "david.thor@architect.io"

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY . .
RUN rm -rf ./node_modules/ && npm config set unsafe-perm=true && npm install
RUN npm link .
RUN git submodule init && git submodule update

RUN cd ./test/calculator-example/test-script/ && \
  architect install -r && \
  architect start
