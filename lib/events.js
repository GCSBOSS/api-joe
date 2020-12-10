const cookieSignature = require('cookie-signature');
const cookie = require('cookie');
const WebSocket = require('ws');
const url = require('url');

/* istanbul ignore next */
function checkClientsHealth(){
    // this => wss
    this.clients.forEach(ws => {
        if(ws.isAlive === false)
            return ws.terminate();
        ws.isAlive = false;
        ws.ping(Function.prototype);
    });
}

async function onConnect(ws, req){
    let addr = req.connection.remoteAddress;
    req.pathname = url.parse(req.url, true).pathname

    ws.isAlive = true;
    ws.on('pong', /* istanbul ignore next */ () => ws.isAlive = true);

    this.log.debug({ type: 'ws', addr }, 'New connection from %s', addr);

    ws.on('close', () => {
        this.log.debug({ type: 'ws', addr }, 'Closed connection from %s', addr);

        if(ws.claim){
            this.global.redis.del('joe:ws:' + ws.claim);
            this.global.redis.publish('joe:ws:close', ws.claim);
            clearInterval(ws.ei);
        }
    });

    /* istanbul ignore next */
    ws.on('error', err => this.log.error({ type: 'ws', addr, err }, 'Error in connection from %s', addr));

    let cookies = cookie.parse(req.headers.cookie || '');
    let signed = cookies[this.conf.cookie.name] || '';
    let sessid = cookieSignature.unsign(signed.substr(2), this.conf.cookie.secret);
    let claim = sessid && await this.global.redis.get(sessid);

    if(claim){
        ws.claim = claim;
        this.global.redis.publish('joe:ws:connect', claim);
        this.global.redis.set('joe:ws:' + claim, 1);
        ws.ei = setInterval(/* istanbul ignore next */ () =>
            this.global.redis.expire('joe:ws:' + claim, 12), 10e3);
    }
    else
        ws.public = true;
}

module.exports = {

    buildWSServer(app){
        let wss = new WebSocket.Server({ noServer: true, path: '/events' });
        wss.on('connection', onConnect.bind(app));
        wss.healthChecker = setInterval(checkClientsHealth.bind(wss), 30000);

        wss.doClose = function(){
            clearInterval(wss.healthChecker);
            let cps = [];
            wss.clients.forEach(ws => {
                cps.push(new Promise(done => ws.on('close', done)));
                ws.terminate();
            });
            return Promise.all(cps);
        };

        app._server.on('upgrade', (req, socket, head) =>
            wss.handleUpgrade(req, socket, head, (ws, req) =>
                wss.emit('connection', ws, req)));

        return wss;
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
        app.global.wss.clients.forEach(ws =>
            (ws.public ? pub : targets[ws.claim] || broadcast)
                && ws.send(data));
    }

}
