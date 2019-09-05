#!node

const { run } = require('nodecaf');
run({
    init: require('../lib/main'),
    confPath: process.env.APIJOE_CONF || './conf.toml'
});
