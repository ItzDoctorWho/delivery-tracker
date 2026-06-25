const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// Proto paths (relative to api-gateway/src/config)
const ORDER_PROTO_PATH = path.join(__dirname, '../../../proto/order.proto');
const DELIVERY_PROTO_PATH = path.join(__dirname, '../../../proto/delivery.proto');
const DRIVER_PROTO_PATH = path.join(__dirname, '../../../proto/driver.proto');

const orderDef = protoLoader.loadSync(ORDER_PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
const deliveryDef = protoLoader.loadSync(DELIVERY_PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
const driverDef = protoLoader.loadSync(DRIVER_PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });

const orderProto = grpc.loadPackageDefinition(orderDef).order;
const deliveryProto = grpc.loadPackageDefinition(deliveryDef).delivery;
const driverProto = grpc.loadPackageDefinition(driverDef).driver;

// Initialize gRPC clients
const orderClient = new orderProto.OrderService(
  process.env.ORDER_SERVICE_URL || '127.0.0.1:50051',
  grpc.credentials.createInsecure()
);

const deliveryClient = new deliveryProto.DeliveryService(
  process.env.DELIVERY_SERVICE_URL || '127.0.0.1:50052',
  grpc.credentials.createInsecure()
);

const driverClient = new driverProto.DriverService(
  process.env.DRIVER_SERVICE_URL || '127.0.0.1:50053',
  grpc.credentials.createInsecure()
);

module.exports = {
  orderClient,
  deliveryClient,
  driverClient,
  grpc
};
