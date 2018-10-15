'use strict';

const first = 10;
const second = 5;

class Architect {
  constructor(subtraction_service) {
    console.log(`Subtracting ${first} by ${second}...`);
    const { MathRequest } = subtraction_service.messages;
    let request = new SubtractionRequest();
    request.setFirst(first);
    request.setSecond(second);
    subtraction_service.client.subtract(request, (error, response) => {
      if (error) {
        console.error(error);
        return process.exit(1);
      }

      console.log(response.getOutput());
      process.exit(0);
    });
  }
}

Architect.dependencies = ['subtraction-service'];

module.exports = Architect;
