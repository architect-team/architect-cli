FROM node:14

WORKDIR /usr/src/app

## copying package.json and npm install before copying directory saves time w/ caching
COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD [ "npm", "start" ]
