const { request } = require('muhb');
const { authn } = require('nodecaf').assertions;

module.exports = {

    async match({ redis, req, flash, next, conf }){
        let claim = req.signedCookies[conf.cookie.name];

        if(typeof claim !== 'string')
            return next();

        if(await redis.exists(claim) === 0)
            return next();

        flash.claim = claim;
        redis.expire(flash.claim, conf.session.timeout);
        next();
    },

    async create({ req, conf, res, redis }){

        let body = '';
        await new Promise(done => {
            req.on('data', buf => body += buf.toString());
            req.on('end', done);
        });

        // Query Auth Provider
        let { status, body: authData } = await request({
            timeout: 3000, body,
            method: conf.auth.method.toLowerCase(),
            url: conf.auth.url,
            headers: { 'Content-Type': 'application/json' }
        });

        authn(status === 200, authData);

        res.cookie(conf.cookie.name, authData, conf.cookie);
        res.end();

        await redis.set(authData, 1);
        redis.expire(authData, conf.session.timeout);
    },

    destroy({ flash, res, redis, conf }){
        let opts = { ...conf.cookie };
        delete opts.maxAge;
        res.clearCookie(conf.cookie.name, opts);
        res.end();
        redis.del(flash.claim);
    }

}
