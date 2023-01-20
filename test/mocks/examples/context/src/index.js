const winston = require('winston');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const start = async () => {
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    defaultMeta: { service: 'architect' },
    transports: [
      new winston.transports.Console(),
    ],
  });

  const app = express();
  app.use(cors());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  app.all('*', (req, res) => {
    logger.info(`${req.method} ${req.url}`);
    res.status(200).json([]);
  });

  return app.listen(8080, () => {
    logger.info(`> Listening on port: 8080`);
  });
};

start();
