FROM node:10-alpine

# RUN npm install -g @architect-io/cli@rc

WORKDIR /usr/src/app

COPY package.json package.json
RUN npm install

COPY tsconfig.json tsconfig.json

COPY bin bin
COPY src src

RUN npm link .

ENTRYPOINT [ "architect" ]
