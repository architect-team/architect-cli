FROM node:12-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
COPY . .

CMD [ "node", "wait-for-it.js" ]
