const periodo = require('periodo');
const redis = require('async-redis');
const { AppServer } = require('nodecaf');
const api = require('./api');

module.exports = function init(){
    let app = new AppServer(__dirname + '/default.toml');
    app.name = 'API Gateway';
    app.version = '0.1.1';
    app.shouldParseBody = false;
    app.alwaysRebuildAPI = true;

    let shared = {};

    app.beforeStart = function({ conf }){

        conf.cookie.maxAge = periodo(conf.cookie.maxAge).time;
        conf.cookie.signed = true;

        conf.session.timeout = Math.floor(periodo(conf.session.timeout).time / 1000);

        var rclient = redis.createClient(conf.redis);
        shared.redis = rclient;

        return new Promise( (done, fail) => {
            rclient.on('connect', done);
            rclient.on('error', fail);
        });
    };

    app.afterStop = function(){
        shared.redis.quit();
    };

    app.expose(shared);
    app.api(api);

    return app;
}
