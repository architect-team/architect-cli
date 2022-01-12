FROM node:14-alpine

RUN apk --no-cache add curl

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
COPY . .

RUN wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
RUN mv global-bundle.pem /etc/ssl/certs/global-bundle.pem

CMD [ "npm", "run", "start" ]
