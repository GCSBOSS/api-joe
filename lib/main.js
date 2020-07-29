const periodo = require('periodo');
const redis = require('async-redis');
const Nodecaf = require('nodecaf');

const api = require('./api');

module.exports = () => new Nodecaf({
    api,
    conf: __dirname + '/default.toml',
    shouldParseBody: false,
    alwaysRebuildAPI: true,

    async startup({ conf, global }){

        global.cookieOpts = {
            maxAge: periodo(conf.session.timeout).time,
            secure: process.env.NODE_ENV == 'production',
            httpOnly: true,
            sameSite: conf.cookie.sameSite,
            signed: true
        };

        conf.session.timeout = Math.floor(global.cookieOpts.maxAge / 1000);

        conf.redis['retry_strategy'] = () => new Error('Redis connection failed');
        global.redis = redis.createClient(conf.redis);
        await new Promise( (done, fail) => {
            global.redis.on('connect', done);
            global.redis.on('error', fail);
            global.redis.on('end', fail);
        });
    },

    async shutdown({ global }){
        await new Promise(done => global.redis.quit(done));
    }
});
