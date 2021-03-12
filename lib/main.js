const redis = require('nodecaf-redis');
const acme = require('acme-client');
const Nodecaf = require('nodecaf');
const periodo = require('periodo');
const https = require('https');
const http = require('http');

const { onBackendEvent, buildWSServer } = require('./events');
const api = require('./api');
const { SNICallback, replyChallenge } = require('./acme');

module.exports = () => new Nodecaf({
    api,
    conf: __dirname + '/default.toml',
    shouldParseBody: false,
    alwaysRebuildAPI: true,

    server(app){
        if(app.conf.acme)
            return https.createServer({ SNICallback: SNICallback.bind(app) });
        return http.createServer();
    },

    async startup(app){
        let envIsProd = process.env.NODE_ENV == 'production';
        let { conf, global } = app;

        global.cookieOpts = {
            maxAge: periodo(conf.session.timeout).time,
            secure: conf.cookie.secure == null ? envIsProd : conf.cookie.secure,
            httpOnly: true,
            sameSite: conf.cookie.sameSite,
            signed: true
        };

        conf.session.timeout = Math.floor(global.cookieOpts.maxAge / 1000);

        global.redis = await redis(conf.redis, 'joe:ws:event', onBackendEvent.bind(global));

        if(conf.acme){
            let accountKey = await global.redis.get('joe:privateKey');
            if(!accountKey){
                accountKey = await acme.forge.createPrivateKey();
                global.redis.set('joe:privateKey', accountKey);
            }

            global.contexts = {};
            let directoryUrl = conf.acme.api || /* istanbul ignore next */(envIsProd
                ? acme.directory.letsencrypt.production
                : acme.directory.letsencrypt.staging);
            global.acmeClient = new acme.Client({ directoryUrl, accountKey });

            global.chlngServer = http.createServer(replyChallenge.bind(global));
            global.chlngServer.listen(conf.acme.challengePort || 5002);
        }

        app.running.then(() => global.wss = buildWSServer(app));
    },

    async shutdown({ global }){
        await global.wss.doClose();
        await global.redis.close();
        global.chlngServer && global.chlngServer.close();
    }
});
