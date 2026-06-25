const { createRxDatabase } = require('rxdb');
const { getRxStorageLoki } = require('rxdb/plugins/storage-lokijs');
const LokiFsStructuredAdapter = require('lokijs/src/loki-fs-structured-adapter.js');

const driverSchema = {
  title: 'driver schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    vehicle: { type: 'string' },
    status: { type: 'string' }, // AVAILABLE, BUSY, OFFLINE
    latitude: { type: 'number' },
    longitude: { type: 'number' }
  },
  required: ['id', 'name', 'vehicle', 'status', 'latitude', 'longitude']
};

let dbPromise = null;

async function getDB() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await createRxDatabase({
        name: 'driverdb',
        storage: getRxStorageLoki({
          adapter: new LokiFsStructuredAdapter()
        })
      });
      await db.addCollections({
        drivers: {
          schema: driverSchema
        }
      });
      return db;
    })();
  }
  return dbPromise;
}

module.exports = { getDB };
