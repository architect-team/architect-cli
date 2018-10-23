// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var service_pb = require('./service_pb.js');

function serialize_SubtractRequest(arg) {
  if (!(arg instanceof service_pb.SubtractRequest)) {
    throw new Error('Expected argument of type SubtractRequest');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_SubtractRequest(buffer_arg) {
  return service_pb.SubtractRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_SubtractionResponse(arg) {
  if (!(arg instanceof service_pb.SubtractionResponse)) {
    // throw new Error('Expected argument of type SubtractionResponse');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_SubtractionResponse(buffer_arg) {
  return service_pb.SubtractionResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var SnappiService = exports.SnappiService = {
  subtract: {
    path: '/Snappi/Subtract',
    requestStream: false,
    responseStream: false,
    requestType: service_pb.SubtractRequest,
    responseType: service_pb.SubtractionResponse,
    requestSerialize: serialize_SubtractRequest,
    requestDeserialize: deserialize_SubtractRequest,
    responseSerialize: serialize_SubtractionResponse,
    responseDeserialize: deserialize_SubtractionResponse,
  },
};

exports.SnappiClient = grpc.makeGenericClientConstructor(SnappiService);
