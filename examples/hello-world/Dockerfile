FROM henriqueholtz/node-win:16.17.0 

WORKDIR /usr/src/app

COPY package.json ./
RUN npm i
COPY . .

CMD [ "npm", "start" ]
