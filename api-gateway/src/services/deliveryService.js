const { deliveryClient } = require('../config/grpc');

const deliveryService = {
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

module.exports = deliveryService;
