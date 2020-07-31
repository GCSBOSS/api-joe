
module.exports = {

    async onClientConnect({ ws, req, conf, redis }){
        let sessid = req.signedCookies[conf.cookie.name];
        let claim = sessid && await redis.get(sessid);

        if(claim){
            ws.claim = claim;
            redis.publish('joe:ws:connect', claim);
            redis.set('joe:ws:' + claim, 1);
            ws.ei = setInterval(/* istanbul ignore next */ () =>
                redis.expire('joe:ws:' + claim, 12), 10e3);
        }
        else
            ws.public = true;
    },

    onClientClose({ ws, redis }){
        if(ws.claim){
            redis.del('joe:ws:' + ws.claim);
            redis.publish('joe:ws:close', ws.claim);
            clearInterval(ws.ei);
        }
    },

    async onBackendEvent(app, channel, message){
        let targets = {};

        let { public: pub, target, except, members, notMembers, data,
            broadcast } = JSON.parse(message);

        [].concat(target).forEach(c => targets[c] = true);
        if(members){
            let cs = await this.smembers(members);
            cs && cs.forEach(c => targets[c] = true);
        }

        [].concat(except).forEach(c => targets[c] = false);
        if(notMembers){
            let cs = await this.smembers(notMembers);
            cs && cs.forEach(c => targets[c] = false);
        }

        delete targets[undefined];

        data = JSON.stringify(data);
        app.websockets.forEach(ws =>
            (broadcast && targets[ws.claim] !== false || targets[ws.claim] || ws.public && pub)
                && ws.send(data));
    }

}
