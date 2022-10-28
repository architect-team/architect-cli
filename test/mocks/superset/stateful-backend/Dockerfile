FROM node:18-alpine AS dev

RUN apk update && apk upgrade && \
    apk add --no-cache curl

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
COPY . .

CMD [ "npm", "start" ]

# split up this way just for the superset testing
FROM node:18-alpine AS production

RUN apk update && apk upgrade && \
    apk add --no-cache curl

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
COPY . .

CMD [ "npm", "start" ]
