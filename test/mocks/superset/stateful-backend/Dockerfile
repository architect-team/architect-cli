FROM node:12-alpine AS dev

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
COPY . .

CMD [ "npm", "start" ]

# split up this way just for the superset testing
FROM node:12-alpine AS production

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
COPY . .

CMD [ "npm", "start" ]
