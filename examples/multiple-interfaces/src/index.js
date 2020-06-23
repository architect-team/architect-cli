const express = require('express');
const bodyParser = require('body-parser');

const admin_app = express();
const public_app = express();

public_app.get('/users', (req, res) => {
  res.status(200).json([
    {
      id: 1,
      name: 'Criss Angel',
    },
    {
      id: 2,
      name: 'David Blaine'
    }
  ]);
});

admin_app.get('/sessions', (req, res) => {
  res.status(200).json([
    {
      id: 1,
      user_id: 1,
      date: new Date(),
    },
    {
      id: 2,
      user_id: 1,
      date: new Date(),
    },
    {
      id: 3,
      user_id: 1,
      date: new Date(),
    }
  ]);
});

public_app.listen(8080, () => {
  console.log('> Listening for public traffic on port: 8080');
});

admin_app.listen(8081, () => {
  console.log('> Listening for admin traffic on port: 8081');
});
