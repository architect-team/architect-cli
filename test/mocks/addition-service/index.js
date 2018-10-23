'use strict';

class Architect {
  constructor(addition_service) {
    this.addition_service = addition_service;
  }

  add(call, callback) {
    const {AddResponse} = this.addition_service.messages;
    const add_request = call.request;
    const response = new AddResponse();
    response.setOutput(add_request.getFirst() + add_request.getSecond());
    callback(null, response);
  }
}

Architect.dependencies = ['addition-service'];

module.exports = Architect;
