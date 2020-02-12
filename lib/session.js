const { request, post } = require('muhb');
const { authn } = require('nodecaf').assertions;

function eraseCookie(conf, res){
    let opts = { ...conf.cookie };
    delete opts.maxAge;
    res.clearCookie(conf.cookie.name, opts);
}

module.exports = {

    async match({ redis, req, flash, next, conf, res }){
        let claim = req.signedCookies[conf.cookie.name];

        if(typeof claim !== 'string')
            return next();

        if(await redis.exists(claim) === 0){
            eraseCookie(conf, res);
            return next();
        }

        flash.claim = claim;
        redis.expire(claim, conf.session.timeout);
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
            timeout: conf.auth.timeout, body,
            method: conf.auth.method,
            url: conf.auth.url,
            headers: { 'Content-Type': 'application/json' }
        });

        authn(status === 200, authData);

        res.cookie(conf.cookie.name, authData, conf.cookie);
        res.end();

        await redis.set(authData, 1);
        redis.expire(authData, conf.session.timeout);

        if(typeof conf.auth.onSuccess == 'string')
            post(conf.auth.onSuccess, { 'X-Joe-Auth': 'success' }, authData);
    },

    destroy({ flash, res, redis, conf }){
        eraseCookie(conf, res);
        res.end();
        redis.del(flash.claim);
    }

}
