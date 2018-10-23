// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var service_pb = require('./service_pb.js');

function serialize_MathRequest(arg) {
  if (!(arg instanceof service_pb.MathRequest)) {
    throw new Error('Expected argument of type MathRequest');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_MathRequest(buffer_arg) {
  return service_pb.MathRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_MathResponse(arg) {
  if (!(arg instanceof service_pb.MathResponse)) {
    throw new Error('Expected argument of type MathResponse');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_MathResponse(buffer_arg) {
  return service_pb.MathResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var SnappiService = exports.SnappiService = {
  divide: {
    path: '/Snappi/Divide',
    requestStream: false,
    responseStream: false,
    requestType: service_pb.MathRequest,
    responseType: service_pb.MathResponse,
    requestSerialize: serialize_MathRequest,
    requestDeserialize: deserialize_MathRequest,
    responseSerialize: serialize_MathResponse,
    responseDeserialize: deserialize_MathResponse,
  },
};

exports.SnappiClient = grpc.makeGenericClientConstructor(SnappiService);
