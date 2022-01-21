require('./tracer');

const winston = require('winston');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

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
const Sequelize = require('sequelize');

const sequelize = new Sequelize(`${process.env.DB_ADDR}${ process.env.DB_USE_SSL === 'true' ? '?sslmode=verify-full' : '' }`, {
  dialect: 'postgres',
  dialectOptions: process.env.DB_USE_SSL === 'true' ? {
    ssl: {
      ca: fs.readFileSync('/etc/ssl/certs/global-bundle.pem').toString(),
    },
  } : {},
  retry: {
    max: 10,
    match: [
      Sequelize.ConnectionError,
      Sequelize.ConnectionRefusedError
    ],
  },
})

const Name = sequelize.define('name', {
  name: Sequelize.STRING
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

app.get('/names', async (req, res) => {
  logger.info(`GET /names`)
  const names = await Name.findAll({
    order: [
      ['id', 'DESC'],
    ]
  });
  return names
    ? res.status(200).json(names)
    : res.status(404).json({ error: 'Not found' });
});

app.post('/names', async (req, res) => {
  try {
    logger.info(`POST /names`);
    const name = await Name.create({ name: req.body.name });
    return res.status(201).json(name);
  } catch (err) {
    return res.status(500);
  }
});

sequelize.sync().then(() => {
  app.listen(process.env.PORT, () => {
    logger.info('Listening on port:', process.env.PORT);
  });
}).catch(err => {
  logger.error('Database schema sync failed:', err);
});
