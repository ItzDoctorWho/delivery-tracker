const { driverClient } = require('../config/grpc');

const driverService = {
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

module.exports = driverService;
