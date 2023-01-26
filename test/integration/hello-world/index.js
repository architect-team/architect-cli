const express = require('express');
const app = express();

app.set('port', (process.env.PORT || 8080));
app.use(express.static(__dirname + '/public'));

app.get('/', (request, response) => {
  response.send(`Hello ${process.env.WORLD_TEXT}!`);
});

app.listen(app.get('port'), () => {
  console.log(`Node app is running at localhost: ${app.get('port')}`);
});
