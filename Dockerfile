FROM node:12-alpine

# RUN npm install -g @architect-io/cli@rc

WORKDIR /usr/src/app

COPY .npmrc package*.json tsconfig.json ./
RUN npm install

COPY bin bin
COPY src src

RUN npm link .

ENTRYPOINT [ "architect" ]
