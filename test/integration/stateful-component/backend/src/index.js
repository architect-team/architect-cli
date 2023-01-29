const winston = require('winston');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { runMigration } = require('./migration');

const start = async () => {
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'backend' },
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: `${__dirname}/../logs/backend.log` })
    ]
  });

  const app = express();
  app.use(cors());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  const Sequelize = require('sequelize');
  const sequelize = new Sequelize(process.env.DB_ADDR, {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    retry: {
      max: 10,
      match: [
        Sequelize.ConnectionError,
        Sequelize.ConnectionRefusedError
      ],
    }
  });

  const SignIns = sequelize.define('name', {
    name: Sequelize.STRING
  });

  await runMigration(sequelize, logger);

  app.get('/sign-ins', async (req, res) => {
    logger.info(`GET /sign-ins`);
    const rows = await SignIns.findAll({
      order: [
        ['id', 'DESC'],
      ]
    });
    return res.status(200).json(rows);
  });

  app.post('/sign-ins', async (req, res) => {
    try {
      logger.info(`POST /sign-ins`);
      const name = await SignIns.create({
        name: req.body.name,
      });
      return res.status(201).json(name);
    } catch (err) {
      return res.status(500);
    }
  });

  app.all('*', (req, res) => {
    res.status(200).json([]);
  });

  return app.listen(8080, () => {
    logger.info(`> Listening on port: 8080`);
  });
};

start();
