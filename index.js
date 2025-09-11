const { TallySoApi } = require('./dist/credentials/TallySoApi.credentials');
const { TallySo } = require('./dist/nodes/TallySo/TallySo.node');

module.exports = {
  credentials: [
    TallySoApi,
  ],
  nodes: [
    TallySo,
  ],
};
