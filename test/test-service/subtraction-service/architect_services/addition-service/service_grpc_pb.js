// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var service_pb = require('./service_pb.js');

function serialize_AddRequest(arg) {
  if (!(arg instanceof service_pb.AddRequest)) {
    throw new Error('Expected argument of type AddRequest');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_AddRequest(buffer_arg) {
  return service_pb.AddRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_AddResponse(arg) {
  if (!(arg instanceof service_pb.AddResponse)) {
    throw new Error('Expected argument of type AddResponse');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_AddResponse(buffer_arg) {
  return service_pb.AddResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var SnappiService = exports.SnappiService = {
  add: {
    path: '/Snappi/Add',
    requestStream: false,
    responseStream: false,
    requestType: service_pb.AddRequest,
    responseType: service_pb.AddResponse,
    requestSerialize: serialize_AddRequest,
    requestDeserialize: deserialize_AddRequest,
    responseSerialize: serialize_AddResponse,
    responseDeserialize: deserialize_AddResponse,
  },
};

exports.SnappiClient = grpc.makeGenericClientConstructor(SnappiService);
