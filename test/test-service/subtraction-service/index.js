'use strict';

class Architect {
  constructor(subtraction_service, addition_service) {
    this.subtraction_service = subtraction_service;
    this.addition_service = addition_service;
  }

  subtract(call, callback) {
    const { SubtractionResponse } = this.subtraction_service.messages;
    const { AddRequest } = this.addition_service.messages;

    let first = call.request.getFirst();
    let second = call.request.getSecond();
    second *= -1;

    const addition_request = new AddRequest();
    addition_request.setFirst(first);
    addition_request.setSecond(second);
    this.addition_service.client.add(
      addition_request,
      (error, addition_response) => {
        if (error) {
          return callback(error);
        } else {
          let response = new SubtractionResponse();
          response.setOutput(addition_response.getOutput());
          return callback(null, response);
        }
      }
    );
  }
}

Architect.dependencies = ['subtraction-service', 'addition-service'];

module.exports = Architect;
