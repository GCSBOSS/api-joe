const assert = require('assert');
const { v4: uuid } = require('uuid');
const { context } = require('muhb');
const Nodecaf = require('nodecaf');

process.env.NODE_ENV = 'testing';

const init = require('../lib/main');

const ACME_GATEWAY = process.env.ACME_GATEWAY || 'host.docker.internal';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const ACME_API_URL = process.env.ACME_API_URL || 'https://localhost:14000/dir';
const SERVICES = {
    unresponsive: { url: 'http://anything', endpoints: [ 'GET /foo' ] },
    backend: { url: 'http://localhost:8060', endpoints: [ 'GET /say/:something', 'GET /headers' ] },
    public: { url: 'http://localhost:8060', exposed: true },
    hostly: { domain: 'foobar', url: 'http://localhost:8060', exposed: true },
    httpsonly: { domain: ACME_GATEWAY, url: 'http://localhost:8060', secure: true, endpoints: [ 'GET /headers' ] }
};
const ACME_CONF = { api: ACME_API_URL, email: 'api-joe@gmail.com' };

let app, base = context('http://127.0.0.1:8236'), secBase = context('https://localhost:8236');

const authProvider = new Nodecaf({
    conf: { port: 8060, log: false },
    api({ post, get }){

        get('/', ({ res }) => res.end())

        post('/auth', ({ res, body }) => {
            if(body)
                return res.status(400).end();
            res.end('ID: ' + uuid());
        });

        get('/say/:something', ({ params, res }) => res.text(params.something));

        get('/headers', ({ headers, res }) => res.json(headers));

        get('/public-only', ({ res }) => res.end('public-only'));
    }
});

before(async function(){
    await authProvider.start();
});

after(async function(){
    await authProvider.stop();
});

beforeEach(async function(){
    this.timeout(4000);
    app = init();
    app.setup({
        port: 8236,
        redis: { host: REDIS_HOST },
        cookie: { name: 'foobaz', secret: 'FOOBAR' },
        services: SERVICES,
        auth: { url: 'http://localhost:8060/auth' }
    });
    await app.start();
});

afterEach(async function(){
    await new Promise(done => setTimeout(done, 400));
    await app.stop();
});

describe('Startup', function(){

    it('Should boot just fine', async function(){
        let { assert } = await base.get('');
        assert.status.is(404);
    });

    it('Should boot just fine even without services', async function(){
        await app.restart({ services: null });
        let { assert } = await base.get('');
        assert.status.is(404);
    });

    it('Should fail when cannot connect to redis', async function(){
        this.timeout(3e3);
        await assert.rejects(app.restart({ redis: { port: 8676 } }));
        app.setup({ redis: { port: 6379 } });
        await app.start();
    });

    it('Should fail if serivce config has unsupported keys', async function(){
        let p = app.restart({ services: { foo: { bar: 'baz' } } });
        await assert.rejects(p, /key 'bar'/ );
    });

});

describe('Proxy', function(){

    it('Should fail when service doesn\'t exist', async function(){
        let { assert } = await base.get('nothing');
        assert.status.is(404);
    });

    it('Should fail when service is unresponsive', async function(){
        this.timeout(4000);
        let { assert } = await base.get('unresponsive/foo');
        assert.status.is(503);
    });

    it('Should fail when endpoint doesn\'t exist', async function(){
        let { assert } = await base.get('backend/public-only');
        assert.status.is(404);
    });

    it('Should reach an exposed service endpoints', async function(){
        let { assert } = await base.get('backend/headers');
        assert.status.is(200);
        assert.body.contains('date');
        let { assert: a2 } = await base.get('backend/say/foobar');
        a2.status.is(200);
        a2.body.exactly('foobar');
    });

    it('Should reach any endpoint of exposed service [*service.exposed]', async function(){
        let { assert } = await base.get('public/public-only');
        assert.status.is(200);
        assert.body.contains('public-only');
        let { assert: a } = await base.get('public/nothing');
        a.status.is(404);
    });

    it('Should preserve cookies from outside when setup [proxy.preserveCookies]', async function(){
        await app.restart({ proxy: { preserveCookies: true } });
        let { assert } = await base.get('backend/headers', { cookies: { foo: 'bar' } });
        assert.body.contains('"cookie":"foo=bar');
    });

    it('Should find service according to HOST header [*service.domain]', async function(){
        let { assert } = await base.get('headers', { 'host': 'hostly' });
        assert.status.is(200);
        assert.body.contains('{');
    });
});

describe('Session', function(){

    describe('POST /login', function(){

        it('Should fail when can\'t reach auth server', async function(){
            this.timeout(2700);
            await app.restart({ auth: { url: 'http://nothing' } });
            let { assert } = await base.post('login');
            assert.status.is(500);
        });

        it('Should return authentication failure when not 200', async function(){
            let { assert } = await base.post('login', { auto: true }, 'must fail');
            assert.status.is(400);
        });

        it('Should return ok when auth succeeds', async function(){
            let { assert } = await base.post('login');
            assert.status.is(200);
        });

        it('Should include claim header when proxying for logged in client', async function(){
            let { assert, cookies } = await base.post('login');
            assert.status.is(200);
            let { assert: a } = await base.get('backend/headers', { cookies });
            a.status.is(200);
            a.body.contains('"x-claim":"ID');
        });

    });

    describe('POST /logout', function(){

        it('Should force expire an active session', async function(){
            await app.restart({ session: { timeout: '1d' } });
            let { cookies } = await base.post('login');
            let { headers } = await base.post('logout', { cookies });
            assert(headers['set-cookie'][0].indexOf('01 Jan 1970') > 0);
        });

    });

});

describe('Events', function(){
    const WebSocket = require('ws');
    const redis = require('async-redis');

    let backend, logWS, pubWS, logWS2, logClaim;

    before(async function(){
        backend = redis.createClient({ host: REDIS_HOST });
        await new Promise( (done, fail) => {
            backend.on('connect', done);
            backend.on('error', fail);
            backend.on('end', fail);
        });
    });

    beforeEach(async function(){
        let { cookies } = await base.post('login');
        let { cookies: c2 } = await base.post('login');
        logClaim = await backend.get(cookies.foobaz.substr(2, 36));
        await backend.sadd(logClaim, logClaim);
        pubWS = new WebSocket('ws://localhost:8236/events');
        logWS = new WebSocket('ws://localhost:8236/events', {
            headers: { 'Cookie': 'foobaz=' + cookies.foobaz }
        });
        logWS2 = new WebSocket('ws://localhost:8236/events', {
            headers: { 'Cookie': 'foobaz=' + c2.foobaz }
        });
    });

    afterEach(function(){
        pubWS.close();
        logWS.close();
        logWS2.close();
    });

    after(function(){
        backend.quit();
    });

    it('Should drop connections to paths other than /events', function(done){
        let ws = new WebSocket('ws://localhost:8236/foobar');
        ws.on('error', () => done());
    });

    it('Should accept Authenticated WS clients', function(done){
        logWS.on('open', () => {
            setTimeout(() => {
                app.global.wss.clients.forEach(ws => assert(ws.claim || ws.public));
                done();
            }, 400);
        });
    });

    it('Should kick clients when stopping', function(done){
        this.timeout(3e3);
        pubWS.on('open', () => {
            setTimeout(() => app.stop(), 2e3);
        });
        pubWS.on('close', async () => {
            await app.start();
            done();
        });
    });

    it('Should broadcast to logged in clients', function(done){
        let c = 0, r = 0;
        let cfn = () => {
            c == 1 &&
                backend.publish('joe:ws:event', '{"broadcast":true,"data":"foobar"}');
            c++;
        };
        let rfn = msg => {
            assert.strictEqual(msg, '"foobar"');
            r == 1 && done();
            r++;
        }
        logWS2.on('open', cfn);
        logWS.on('open', cfn);
        logWS2.on('message', rfn);
        logWS.on('message', rfn);
    });

    it('Should notify only public clients', function(done){
        let c = 0;
        let cfn = () => {
            c == 1 &&
                backend.publish('joe:ws:event', '{"public":true,"data":"foobar"}');
            c++;
        };
        pubWS.on('open', cfn);
        logWS.on('open', cfn);
        pubWS.on('message', () => done());
        logWS.on('message', () => done(new Error('Logged client received public message')));
    });

    it('Should notify only targeted clients', function(done){
        let c = 0;
        let cfn = () => {
            c == 2 &&
                backend.publish('joe:ws:event', '{"target":"' + logClaim + '","data":"foobar"}');
            c++;
        };

        pubWS.on('open', cfn);
        logWS.on('open', cfn);
        logWS2.on('open', cfn);
        logWS.on('message', () => setTimeout(done, 400));
        pubWS.on('message', () => done(new Error('Logged client received public message')));
        logWS2.on('message', () => done(new Error('Logged client received public message')));
    });

    it('Should notify only targeted group', function(done){
        let c = 0;
        let cfn = () => {
            c == 2 &&
                backend.publish('joe:ws:event', '{"members":"' + logClaim + '","data":"foobar"}');
            c++;
        };
        pubWS.on('open', cfn);
        logWS.on('open', cfn);
        logWS2.on('open', cfn);
        logWS.on('message', () => done());
        pubWS.on('message', () => done(new Error('Logged client received public message')));
        logWS2.on('message', () => done(new Error('Logged client received public message')));
    });

    it('Should notify only targeted group with exception', function(done){
        let c = 0;
        let cfn = () => {
            c == 2 &&
                backend.publish('joe:ws:event', `{"except":["${logClaim}"], "members":"${logClaim}","data":"foobar"}`);
            c++;
        };
        pubWS.on('open', cfn);
        logWS.on('open', cfn);
        logWS2.on('open', cfn);
        logWS.on('message', () => done(new Error('Logged client received public message')));
        pubWS.on('message', () => done(new Error('Logged client received public message')));
        logWS2.on('message', () => done(new Error('Logged client received public message')));
        setTimeout(done, 400);
    });

    it('Should notify only targeted clients except within group', function(done){
        let c = 0;
        let cfn = () => {
            c == 2 &&
                backend.publish('joe:ws:event', `{"target":["${logClaim}"], "notMembers":"${logClaim}","data":"foobar"}`);
            c++;
        };
        pubWS.on('open', cfn);
        logWS.on('open', cfn);
        logWS2.on('open', cfn);
        logWS.on('message', () => done(new Error('Logged client received public message')));
        pubWS.on('message', () => done(new Error('Logged client received public message')));
        logWS2.on('message', () => done(new Error('Logged client received public message')));
        setTimeout(done, 400);
    });

});

describe('ACME', function(){
    const redis = require('async-redis');
    let redisClient;
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

    before(async function(){
        redisClient = redis.createClient({ host: REDIS_HOST });
        await new Promise( (done, fail) => {
            redisClient.on('connect', done);
            redisClient.on('error', fail);
            redisClient.on('end', fail);
        });
    });

    after(function(){
        redisClient.quit();
    });

    it('Should handle SSL when ACME is setup', async function(){
        this.timeout(6e3);

        await redisClient.del('joe:privateKey');
        await redisClient.del('joe:domains:' + ACME_GATEWAY);

        await app.restart({ acme: ACME_CONF });

        let { assert } = await secBase.get('headers', { 'host': ACME_GATEWAY });
        assert.status.is(200);
        // TODO actually validate if cert is OK?
    });

    it('Should reuse SSl cert while still valid', async function(){
        this.timeout(6e3);

        await redisClient.del('joe:domains:' + ACME_GATEWAY);

        await app.restart({ acme: ACME_CONF });

        await secBase.get('headers', { 'host': ACME_GATEWAY });
        let { assert } = await secBase.get('headers', { 'host': ACME_GATEWAY });
        assert.status.is(200);
        // TODO actually validate if cert is OK?
    });

    it('Should default to Self Signed cert in case of ACME error', async function(){
        this.timeout(6e3);

        await redisClient.del('joe:privateKey');
        await redisClient.del('joe:domains:' + ACME_GATEWAY);

        await app.restart({ acme: ACME_CONF });

        // Passing HOST that is unreachable to Pebble
        let { assert } = await secBase.get('headers', { 'host': 'httpsonly' });
        assert.status.is(200);
        // TODO actually validate if cert is OK?
    });

});

describe('Settings', function(){

    it('Should create signed cookie when auth succeeds [cookie.name]', async function(){
        await app.restart({ cookie: { name: 'foobar' } });
        let { cookies } = await base.post('login');
        assert.strictEqual(cookies.foobar.charAt(0), 's');
    });

    it('Should add setup header when proxying after auth [cookie.*][proxy.claimHeader]', async function(){
        await app.restart({ proxy: { claimHeader: 'X-Foo' } });
        let { cookies } = await base.post('login');
        let { assert } = await base.get('backend/headers', { cookies });
        assert.body.contains('"x-foo":');
    });

    it('Should expire auth data after the setup timeout [session.timeout]', async function(){
        await app.restart({ session: { timeout: '1s' } });
        let { cookies } = await base.post('login');
        await new Promise(done => setTimeout(done, 1500));
        let { body } = await base.get('backend/headers', { cookies });
        assert(body.indexOf('x-claim') < 0);
    });

    it('Should POST to specified URL when auth succeeds [auth.onSuccess]', function(done){
        let serv = require('http').createServer((req, res) => {
            assert.strictEqual(req.headers['x-joe-auth'], 'success');
            serv.close();
            res.end();
            done();
        });
        serv.listen(2345);
        (async () => {
            await app.restart({ auth: { onSuccess: 'http://localhost:2345' } });
            await base.post('login');
        })();
    });

});

describe('Regression', function(){

    it('Should respond to path /', async function(){
        let { assert } = await base.get('', { 'host': 'hostly' });
        assert.status.is(200);
    });

    it('Should be ok being logged in successively (nodecaf fixed bug)', async function(){
        let { cookies } = await base.post('login');
        await base.post('logout', { cookies });
        let { cookies: cs } = await base.post('login');
        await base.post('logout', { cookies: cs });
        let { headers } = await base.post('login');
        assert(headers['set-cookie'][0].indexOf('Max-Age=0') < 0);
    });

});
