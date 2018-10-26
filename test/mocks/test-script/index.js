'use strict';

const first = 50;
const second = 5;

class Architect {
  constructor(division_service) {
    this.division_service = division_service;
  }

  async run() {
    console.log(`Dividing ${first} by ${second}...`);
    let request = new this.division_service.messages.MathRequest();
    request.setFirst(first);
    request.setSecond(second);
    this.division_service.client.divide(request, (error, response) => {
      if (error) {
        return console.error(error);
      }

      console.log(response.getOutput());
    });
  }
}

Architect.dependencies = ['division-service'];

module.exports = Architect;
