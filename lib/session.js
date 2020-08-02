const { request, post } = require('muhb');
const { v4: uuid } = require('uuid');

module.exports = {

    async match({ cookieOpts, redis, req, flash, next, conf, res }){
        let sessid = req.signedCookies[conf.cookie.name];
        if(typeof sessid !== 'string')
            return next();

        if(! (flash.claim = await redis.get(sessid)) ){
            res.clearCookie(conf.cookie.name, cookieOpts);
            return next();
        }

        flash.sessid = sessid;
        redis.expire(sessid, conf.session.timeout);
        next();
    },

    async create({ cookieOpts, req, conf, res, redis }){

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
            headers: conf.auth.headers
        });

        res.badRequest(status !== 200, authData);

        let sessid = uuid();

        res.cookie(conf.cookie.name, sessid, cookieOpts).end();

        await redis.set(sessid, authData);
        redis.expire(sessid, conf.session.timeout);

        if(typeof conf.auth.onSuccess == 'string')
            post(conf.auth.onSuccess, { 'X-Joe-Auth': 'success' }, authData);
    },

    destroy({ cookieOpts, flash, res, redis, conf }){
        res.clearCookie(conf.cookie.name, cookieOpts);
        res.end();
        redis.del(flash.sessid);
    }

}
