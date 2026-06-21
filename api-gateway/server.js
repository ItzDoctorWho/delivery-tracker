const path = require('path');
const express = require('express');
const cors = require('cors');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');

// Load Proto definitions
const ORDER_PROTO_PATH = path.join(__dirname, '../proto/order.proto');
const DELIVERY_PROTO_PATH = path.join(__dirname, '../proto/delivery.proto');
const DRIVER_PROTO_PATH = path.join(__dirname, '../proto/driver.proto');

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

// Promise-based helpers for gRPC calls
const orderApi = {
  create: (data) => new Promise((resolve, reject) => {
    orderClient.createOrder(data, (err, res) => err ? reject(err) : resolve(res));
  }),
  get: (id) => new Promise((resolve, reject) => {
    orderClient.getOrder({ id }, (err, res) => err ? reject(err) : resolve(res));
  }),
  updateStatus: (id, status) => new Promise((resolve, reject) => {
    orderClient.updateOrderStatus({ id, status }, (err, res) => err ? reject(err) : resolve(res));
  }),
  list: () => new Promise((resolve, reject) => {
    orderClient.listOrders({}, (err, res) => err ? reject(err) : resolve(res.orders || []));
  })
};

const driverApi = {
  create: (data) => new Promise((resolve, reject) => {
    driverClient.createDriver(data, (err, res) => err ? reject(err) : resolve(res));
  }),
  get: (id) => new Promise((resolve, reject) => {
    driverClient.getDriver({ id }, (err, res) => err ? reject(err) : resolve(res));
  }),
  updateLocation: (id, latitude, longitude) => new Promise((resolve, reject) => {
    driverClient.updateDriverLocation({ id, latitude, longitude }, (err, res) => err ? reject(err) : resolve(res));
  }),
  updateStatus: (id, status) => new Promise((resolve, reject) => {
    driverClient.updateDriverStatus({ id, status }, (err, res) => err ? reject(err) : resolve(res));
  }),
  list: () => new Promise((resolve, reject) => {
    driverClient.listDrivers({}, (err, res) => err ? reject(err) : resolve(res.drivers || []));
  })
};

const deliveryApi = {
  create: (data) => new Promise((resolve, reject) => {
    deliveryClient.createDelivery(data, (err, res) => err ? reject(err) : resolve(res));
  }),
  get: (id) => new Promise((resolve, reject) => {
    deliveryClient.getDelivery({ id }, (err, res) => err ? reject(err) : resolve(res));
  }),
  updateStatus: (id, status) => new Promise((resolve, reject) => {
    deliveryClient.updateDeliveryStatus({ id, status }, (err, res) => err ? reject(err) : resolve(res));
  }),
  getByOrder: (order_id) => new Promise((resolve, reject) => {
    deliveryClient.getDeliveryByOrder({ order_id }, (err, res) => err ? reject(err) : resolve(res));
  }),
  list: () => new Promise((resolve, reject) => {
    deliveryClient.listDeliveries({}, (err, res) => err ? reject(err) : resolve(res.deliveries || []));
  })
};

const app = express();
app.use(cors());
app.use(express.json());

// --- REST ROUTES ---

// Orders REST
app.post('/api/orders', async (req, res) => {
  try {
    const order = await orderApi.create(req.body);
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await orderApi.get(req.params.id);
    res.json(order);
  } catch (err) {
    res.status(err.code === grpc.status.NOT_FOUND ? 404 : 500).json({ error: err.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await orderApi.list();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Drivers REST
app.post('/api/drivers', async (req, res) => {
  try {
    const driver = await driverApi.create(req.body);
    res.status(201).json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/drivers', async (req, res) => {
  try {
    const drivers = await driverApi.list();
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/drivers/:id/location', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const driver = await driverApi.updateLocation(req.params.id, parseFloat(latitude), parseFloat(longitude));
    res.json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/drivers/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const driver = await driverApi.updateStatus(req.params.id, status);
    res.json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deliveries REST
app.get('/api/deliveries', async (req, res) => {
  try {
    const deliveries = await deliveryApi.list();
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/deliveries/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const delivery = await deliveryApi.updateStatus(req.params.id, status);
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GRAPHQL SETUP ---
const typeDefs = `#graphql
  type Order {
    id: ID!
    customer_id: String!
    pickup_address: String!
    delivery_address: String!
    status: String!
    items: String!
    price: Float!
    created_at: String!
  }

  type Driver {
    id: ID!
    name: String!
    vehicle: String!
    status: String!
    latitude: Float!
    longitude: Float!
  }

  type Delivery {
    id: ID!
    order_id: ID!
    driver_id: ID!
    status: String!
    assigned_at: String!
    picked_up_at: String!
    delivered_at: String!
  }

  type Query {
    order(id: ID!): Order
    orders: [Order]
    driver(id: ID!): Driver
    drivers: [Driver]
    delivery(id: ID!): Delivery
    deliveries: [Delivery]
    deliveryByOrder(order_id: ID!): Delivery
  }

  type Mutation {
    createOrder(customer_id: String!, pickup_address: String!, delivery_address: String!, items: String!, price: Float!): Order
    createDriver(name: String!, vehicle: String!): Driver
    updateDriverLocation(id: ID!, latitude: Float!, longitude: Float!): Driver
    updateDeliveryStatus(id: ID!, status: String!): Delivery
  }
`;

const resolvers = {
  Query: {
    order: (_, { id }) => orderApi.get(id),
    orders: () => orderApi.list(),
    driver: (_, { id }) => driverApi.get(id),
    drivers: () => driverApi.list(),
    delivery: (_, { id }) => deliveryApi.get(id),
    deliveries: () => deliveryApi.list(),
    deliveryByOrder: (_, { order_id }) => deliveryApi.getByOrder(order_id)
  },
  Mutation: {
    createOrder: (_, args) => orderApi.create(args),
    createDriver: (_, args) => driverApi.create(args),
    updateDriverLocation: (_, { id, latitude, longitude }) => driverApi.updateLocation(id, latitude, longitude),
    updateDeliveryStatus: (_, { id, status }) => deliveryApi.updateStatus(id, status)
  }
};

async function startServer() {
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers
  });
  await apolloServer.start();

  app.use('/graphql', expressMiddleware(apolloServer));

  const port = process.env.PORT || '4000';
  app.listen(port, () => {
    console.log(`API Gateway REST running on http://localhost:${port}/api`);
    console.log(`API Gateway GraphQL running on http://localhost:${port}/graphql`);
  });
}

startServer();
