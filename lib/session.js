const { request, post } = require('muhb');
const { authn } = require('nodecaf').assertions;
const { v4: uuid } = require('uuid');

function eraseCookie(conf, res){
    let opts = { ...conf.cookie };
    delete opts.maxAge;
    res.clearCookie(conf.cookie.name, opts);
}

module.exports = {

    async match({ redis, req, flash, next, conf, res }){
        let sessid = req.signedCookies[conf.cookie.name];
        if(typeof sessid !== 'string')
            return next();

        let claim = await redis.get(sessid);
        if(!claim){
            eraseCookie(conf, res);
            return next();
        }

        flash.claim = claim;
        flash.sessid = sessid;
        redis.expire(sessid, conf.session.timeout);
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

        let sessid = uuid();

        res.cookie(conf.cookie.name, sessid, conf.cookie);
        res.end();

        await redis.set(sessid, authData);
        redis.expire(sessid, conf.session.timeout);

        if(typeof conf.auth.onSuccess == 'string')
            post(conf.auth.onSuccess, { 'X-Joe-Auth': 'success' }, authData);
    },

    destroy({ flash, res, redis, conf }){
        eraseCookie(conf, res);
        res.end();
        redis.del(flash.sessid);
    }

}
