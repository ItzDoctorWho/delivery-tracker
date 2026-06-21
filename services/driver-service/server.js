const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { getDB } = require('./database');
const { Kafka, logLevel } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const PROTO_PATH = path.join(__dirname, '../../proto/driver.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const driverProto = grpc.loadPackageDefinition(packageDefinition).driver;

// Initialize Kafka
const kafka = new Kafka({
  clientId: 'driver-service',
  brokers: [process.env.KAFKA_BROKERS || '127.0.0.1:9092'],
  logLevel: logLevel.NOTHING
});
const producer = kafka.producer();

async function startKafka() {
  try {
    await producer.connect();
    console.log('Kafka Driver Producer connected successfully.');
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

async function createDriver(call, callback) {
  try {
    const db = await getDB();
    const { name, vehicle } = call.request;
    const driver = {
      id: uuidv4(),
      name,
      vehicle,
      status: 'AVAILABLE',
      latitude: 0.0,
      longitude: 0.0
    };
    await db.drivers.insert(driver);
    await publishEvent('driver.created', driver);
    callback(null, driver);
  } catch (err) {
    callback({
      code: grpc.status.INTERNAL,
      details: err.message
    });
  }
}

async function getDriver(call, callback) {
  try {
    const db = await getDB();
    const doc = await db.drivers.findOne(call.request.id).exec();
    if (!doc) {
      return callback({
        code: grpc.status.NOT_FOUND,
        details: `Driver not found`
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

async function updateDriverLocation(call, callback) {
  try {
    const db = await getDB();
    const { id, latitude, longitude } = call.request;
    const doc = await db.drivers.findOne(id).exec();
    if (!doc) {
      return callback({
        code: grpc.status.NOT_FOUND,
        details: `Driver not found`
      });
    }
    const updated = await doc.patch({ latitude, longitude });
    await publishEvent('driver.location_updated', updated.toJSON());
    callback(null, updated.toJSON());
  } catch (err) {
    callback({
      code: grpc.status.INTERNAL,
      details: err.message
    });
  }
}

async function updateDriverStatus(call, callback) {
  try {
    const db = await getDB();
    const { id, status } = call.request;
    const doc = await db.drivers.findOne(id).exec();
    if (!doc) {
      return callback({
        code: grpc.status.NOT_FOUND,
        details: `Driver not found`
      });
    }
    const updated = await doc.patch({ status });
    await publishEvent('driver.status_updated', updated.toJSON());
    callback(null, updated.toJSON());
  } catch (err) {
    callback({
      code: grpc.status.INTERNAL,
      details: err.message
    });
  }
}

async function listDrivers(call, callback) {
  try {
    const db = await getDB();
    const docs = await db.drivers.find().exec();
    const drivers = docs.map(d => d.toJSON());
    callback(null, { drivers });
  } catch (err) {
    callback({
      code: grpc.status.INTERNAL,
      details: err.message
    });
  }
}

function main() {
  const server = new grpc.Server();
  server.addService(driverProto.DriverService.service, {
    createDriver,
    getDriver,
    updateDriverLocation,
    updateDriverStatus,
    listDrivers
  });
  
  const port = process.env.PORT || '50053';
  server.bindAsync(`127.0.0.1:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(`Driver Service gRPC Server running on port ${boundPort}`);
    startKafka();
  });
}

main();
