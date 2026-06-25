const express = require('express');
const router = express.Router();
const driverService = require('../services/driverService');

router.post('/', async (req, res) => {
  try {
    const driver = await driverService.create(req.body);
    res.status(201).json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const drivers = await driverService.list();
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/location', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const driver = await driverService.updateLocation(req.params.id, parseFloat(latitude), parseFloat(longitude));
    res.json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const driver = await driverService.updateStatus(req.params.id, status);
    res.json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
