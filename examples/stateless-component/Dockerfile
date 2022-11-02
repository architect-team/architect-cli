# TODO: re-update this and others dependencies, etc
FROM node:12-alpine

# added to support CI job
RUN apk update && apk upgrade && \
    apk add --no-cache curl

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

CMD [ "npm", "run", "start" ]
