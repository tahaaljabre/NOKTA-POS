// Flexible & Extensible Database Schema Definitions
const { schemaQueries: tableQueries } = require('./schema-tables');
const { schemaQueries: indexQueries } = require('./schema-indexes');
const schemaQueries = [...tableQueries, ...indexQueries];
module.exports = { schemaQueries };
