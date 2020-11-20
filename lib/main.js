const redis = require('async-redis');
const Nodecaf = require('nodecaf');
const periodo = require('periodo');
const https = require('https');
const http = require('http');

const { onBackendEvent, buildWSServer } = require('./events');
const api = require('./api');
let subber;

async function getRedisClient(conf){
    let client = redis.createClient(conf);
    await new Promise( (done, fail) => {
        client.on('connect', done);
        client.on('error', fail);
        client.on('end', () => fail(new Error('Redis connection aborted')));
    });
    return client;
}

module.exports = () => new Nodecaf({
    api,
    conf: __dirname + '/default.toml',
    shouldParseBody: false,
    alwaysRebuildAPI: true,

    async startup(app){

        let { conf, global } = app;

        global.cookieOpts = {
            maxAge: periodo(conf.session.timeout).time,
            secure: process.env.NODE_ENV == 'production',
            httpOnly: true,
            sameSite: conf.cookie.sameSite,
            signed: true
        };

        conf.session.timeout = Math.floor(global.cookieOpts.maxAge / 1000);

        conf.redis['retry_strategy'] = () => new Error('Redis connection failed');
        global.redis = await getRedisClient(conf.redis);

        subber = await getRedisClient(conf.redis);
        subber.on('message', onBackendEvent.bind(global.redis, this));
        subber.subscribe('joe:ws:event');

        app.running.then(() => global.wss = buildWSServer(app));
    },

    async shutdown({ global }){
        await global.wss.doClose();
        await new Promise(done => global.redis.quit(done));
        await new Promise(done => subber.quit(done));
    }
});
