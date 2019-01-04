'use strict';

class Architect {
  constructor(division_service, subtraction_service) {
    this.division_service = division_service;
    this.subtraction_service = subtraction_service;
  }

  divide_values(result, value, magnitude, callback) {
    if (value <= 0) {
      let divide_response = new this.division_service.messages.MathResponse();
      divide_response.setOutput(result);
      return callback(null, divide_response);
    }

    let subtract_request = new this.subtraction_service.messages.SubtractRequest();
    subtract_request.setFirst(value);
    subtract_request.setSecond(magnitude);
    this.subtraction_service.client.subtract(
      subtract_request,
      (error, response) => {
        if (error) return callback(error);
        return this.divide_values(result + 1, response.getOutput(), magnitude, callback);
      }
    );
  }

  divide(call, callback) {
    const math_request = call.request;
    return this.divide_values(0, math_request.getFirst(), math_request.getSecond(), callback);
  }
}

Architect.dependencies = ['division-service', 'subtraction-service'];

module.exports = Architect;
