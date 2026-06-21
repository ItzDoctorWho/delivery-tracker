const { createRxDatabase } = require('rxdb');
const { getRxStorageMemory } = require('rxdb/plugins/storage-memory');

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
        storage: getRxStorageMemory()
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
