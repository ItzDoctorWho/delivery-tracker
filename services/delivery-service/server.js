const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { getDB } = require('./database');
const { Kafka, logLevel } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

// Proto paths
const DELIVERY_PROTO_PATH = path.join(__dirname, '../../proto/delivery.proto');
const topics = require('../../proto/topics');
const DRIVER_PROTO_PATH = path.join(__dirname, '../../proto/driver.proto');
const ORDER_PROTO_PATH = path.join(__dirname, '../../proto/order.proto');

const deliveryDef = protoLoader.loadSync(DELIVERY_PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
const driverDef = protoLoader.loadSync(DRIVER_PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
const orderDef = protoLoader.loadSync(ORDER_PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });

const deliveryProto = grpc.loadPackageDefinition(deliveryDef).delivery;
const driverProto = grpc.loadPackageDefinition(driverDef).driver;
const orderProto = grpc.loadPackageDefinition(orderDef).order;

// Clients for other microservices
const driverClient = new driverProto.DriverService(
  process.env.DRIVER_SERVICE_URL || '127.0.0.1:50053',
  grpc.credentials.createInsecure()
);

const orderClient = new orderProto.OrderService(
  process.env.ORDER_SERVICE_URL || '127.0.0.1:50051',
  grpc.credentials.createInsecure()
);

// Initialize Kafka
const kafka = new Kafka({
  clientId: 'delivery-service',
  brokers: [process.env.KAFKA_BROKERS || '127.0.0.1:9092'],
  logLevel: logLevel.NOTHING
});
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'delivery-group' });

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

// Helper to query available drivers
function getAvailableDriver() {
  return new Promise((resolve, reject) => {
    driverClient.listDrivers({}, (err, response) => {
      if (err) return reject(err);
      const available = (response.drivers || []).find(d => d.status === 'AVAILABLE');
      resolve(available);
    });
  });
}

// Helper to update driver status
function updateDriverStatus(id, status) {
  return new Promise((resolve, reject) => {
    driverClient.updateDriverStatus({ id, status }, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

// Helper to update order status
function updateOrderStatus(id, status) {
  return new Promise((resolve, reject) => {
    orderClient.updateOrderStatus({ id, status }, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

async function createDelivery(call, callback) {
  try {
    const db = await getDB();
    const { order_id, driver_id } = call.request;

    // Check if delivery already exists for this order
    const existing = await db.deliveries.findOne({ selector: { order_id } }).exec();
    if (existing) {
      return callback({
        code: grpc.status.ALREADY_EXISTS,
        details: `Delivery for order ${order_id} already exists`
      });
    }

    const delivery = {
      id: uuidv4(),
      order_id,
      driver_id,
      status: 'ASSIGNED',
      assigned_at: new Date().toISOString(),
      picked_up_at: '',
      delivered_at: ''
    };

    // Update driver to BUSY
    await updateDriverStatus(driver_id, 'BUSY');
    // Update order status to ASSIGNED
    await updateOrderStatus(order_id, 'ASSIGNED');

    await db.deliveries.insert(delivery);
    await publishEvent(topics.DELIVERY_CREATED, delivery);

    callback(null, delivery);
  } catch (err) {
    callback({
      code: grpc.status.INTERNAL,
      details: err.message
    });
  }
}

async function getDelivery(call, callback) {
  try {
    const db = await getDB();
    const doc = await db.deliveries.findOne(call.request.id).exec();
    if (!doc) {
      return callback({
        code: grpc.status.NOT_FOUND,
        details: `Delivery not found`
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

async function updateDeliveryStatus(call, callback) {
  try {
    const db = await getDB();
    const { id, status } = call.request; // PICKED_UP, DELIVERED, CANCELLED
    const doc = await db.deliveries.findOne(id).exec();
    if (!doc) {
      return callback({
        code: grpc.status.NOT_FOUND,
        details: `Delivery not found`
      });
    }

    const patch = { status };
    if (status === 'PICKED_UP') {
      patch.picked_up_at = new Date().toISOString();
      await updateOrderStatus(doc.order_id, 'PICKED_UP');
    } else if (status === 'DELIVERED') {
      patch.delivered_at = new Date().toISOString();
      await updateOrderStatus(doc.order_id, 'DELIVERED');
      await updateDriverStatus(doc.driver_id, 'AVAILABLE');
    } else if (status === 'CANCELLED') {
      await updateOrderStatus(doc.order_id, 'CANCELLED');
      await updateDriverStatus(doc.driver_id, 'AVAILABLE');
    }

    const updated = await doc.patch(patch);
    await publishEvent(topics.DELIVERY_UPDATED, updated.toJSON());
    callback(null, updated.toJSON());
  } catch (err) {
    callback({
      code: grpc.status.INTERNAL,
      details: err.message
    });
  }
}

async function getDeliveryByOrder(call, callback) {
  try {
    const db = await getDB();
    const doc = await db.deliveries.findOne({ selector: { order_id: call.request.order_id } }).exec();
    if (!doc) {
      return callback({
        code: grpc.status.NOT_FOUND,
        details: `Delivery for order ${call.request.order_id} not found`
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

async function listDeliveries(call, callback) {
  try {
    const db = await getDB();
    const docs = await db.deliveries.find().exec();
    const deliveries = docs.map(d => d.toJSON());
    callback(null, { deliveries });
  } catch (err) {
    callback({
      code: grpc.status.INTERNAL,
      details: err.message
    });
  }
}

async function startKafka() {
  try {
    const admin = kafka.admin();
    await admin.connect();
    await admin.createTopics({
      topics: [{ topic: topics.ORDER_CREATED }]
    });
    await admin.disconnect();
    
    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({ topic: topics.ORDER_CREATED, fromBeginning: true });
    
    console.log('Kafka Consumer & Producer in Delivery Service connected successfully.');
    
    await consumer.run({
      eachMessage: async ({ message }) => {
        const order = JSON.parse(message.value.toString());
        console.log(`[Kafka Consumer] Received order.created event for Order ID: ${order.id}`);
        
        try {
          // Attempt auto-assignment of driver
          const driver = await getAvailableDriver();
          if (driver) {
            console.log(`[Auto-Assign] Found available driver: ${driver.name} (ID: ${driver.id})`);
            
            // Build gRPC call payload
            const db = await getDB();
            const delivery = {
              id: uuidv4(),
              order_id: order.id,
              driver_id: driver.id,
              status: 'ASSIGNED',
              assigned_at: new Date().toISOString(),
              picked_up_at: '',
              delivered_at: ''
            };
            
            await updateDriverStatus(driver.id, 'BUSY');
            await updateOrderStatus(order.id, 'ASSIGNED');
            await db.deliveries.insert(delivery);
            await publishEvent(topics.DELIVERY_CREATED, delivery);
            
            console.log(`[Auto-Assign] Successfully assigned driver ${driver.id} to order ${order.id}`);
          } else {
            console.log(`[Auto-Assign] No available drivers found for Order ID ${order.id}. Waiting for driver availability.`);
          }
        } catch (assignErr) {
          console.error('[Auto-Assign] Error during driver assignment:', assignErr.message);
        }
      }
    });
  } catch (err) {
    console.error('Kafka consumer/producer startup error:', err.message);
  }
}

function main() {
  const server = new grpc.Server();
  server.addService(deliveryProto.DeliveryService.service, {
    createDelivery,
    getDelivery,
    updateDeliveryStatus,
    getDeliveryByOrder,
    listDeliveries
  });

  const port = process.env.PORT || '50052';
  server.bindAsync(`127.0.0.1:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(`Delivery Service gRPC Server running on port ${boundPort}`);
    startKafka();
  });
}

main();
