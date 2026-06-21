const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { getDB } = require('./database');
const { Kafka, logLevel } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const PROTO_PATH = path.join(__dirname, '../../proto/order.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const orderProto = grpc.loadPackageDefinition(packageDefinition).order;

// Initialize Kafka
const kafka = new Kafka({
  clientId: 'order-service',
  brokers: [process.env.KAFKA_BROKERS || '127.0.0.1:9092'],
  logLevel: logLevel.NOTHING
});
const producer = kafka.producer();

async function startKafka() {
  try {
    await producer.connect();
    console.log('Kafka Order Producer connected successfully.');
  } catch (error) {
    console.error('Failed to connect Kafka Producer:', error.message);
  }
}

async function publishEvent(topic, data) {
  try {
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(data) }]
    });
    console.log(`Event sent to Kafka topic [${topic}]`);
  } catch (err) {
    console.error(`Error sending event to Kafka:`, err.message);
  }
}

async function createOrder(call, callback) {
  try {
    const db = await getDB();
    const { customer_id, pickup_address, delivery_address, items, price } = call.request;
    const order = {
      id: uuidv4(),
      customer_id,
      pickup_address,
      delivery_address,
      status: 'PENDING',
      items,
      price: parseFloat(price),
      created_at: new Date().toISOString()
    };

    await db.orders.insert(order);
    await publishEvent('order.created', order);
    callback(null, order);
  } catch (err) {
    callback({
      code: grpc.status.INTERNAL,
      details: err.message
    });
  }
}

async function getOrder(call, callback) {
  try {
    const db = await getDB();
    const doc = await db.orders.findOne(call.request.id).exec();
    if (!doc) {
      return callback({
        code: grpc.status.NOT_FOUND,
        details: `Order with ID ${call.request.id} not found`
      });
    }
    callback(null, doc.toJSON());
  } catch (err) {
    callback({
      code: grpc.status.INTERNAL,
      details: err.message
    });
  }
}

async function updateOrderStatus(call, callback) {
  try {
    const db = await getDB();
    const { id, status } = call.request;
    const doc = await db.orders.findOne(id).exec();
    if (!doc) {
      return callback({
        code: grpc.status.NOT_FOUND,
        details: `Order not found`
      });
    }
    const updated = await doc.patch({ status });
    await publishEvent('order.status_updated', updated.toJSON());
    callback(null, updated.toJSON());
  } catch (err) {
    callback({
      code: grpc.status.INTERNAL,
      details: err.message
    });
  }
}

async function listOrders(call, callback) {
  try {
    const db = await getDB();
    const docs = await db.orders.find().exec();
    const orders = docs.map(d => d.toJSON());
    callback(null, { orders });
  } catch (err) {
    callback({
      code: grpc.status.INTERNAL,
      details: err.message
    });
  }
}

function main() {
  const server = new grpc.Server();
  server.addService(orderProto.OrderService.service, {
    createOrder,
    getOrder,
    updateOrderStatus,
    listOrders
  });

  const port = process.env.PORT || '50051';
  server.bindAsync(`127.0.0.1:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(`Order Service gRPC Server running on port ${boundPort}`);
    startKafka();
  });
}

main();
