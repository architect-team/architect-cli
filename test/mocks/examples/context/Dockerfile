FROM node:16-alpine

# added to support CI job
RUN apk update && apk upgrade && \
  apk add --no-cache curl

WORKDIR /usr/src/app

COPY package*.json .
RUN npm install
COPY . .

CMD [ "npm", "start" ]
