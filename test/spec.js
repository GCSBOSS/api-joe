const assert = require('assert');
const { v4: uuid } = require('uuid');
const { context } = require('muhb');
const { AppServer } = require('nodecaf');

process.env.NODE_ENV = 'testing';

const init = require('../lib/main');

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const SERVICES = {
    ws: { url: 'ws://localhost:1234', endpoints: [ 'GET /ws' ] },
    unresponsive: { url: 'http://anything', endpoints: [ 'GET /foo' ] },
    backend: { url: 'http://localhost:8060', endpoints: [ 'GET /get', 'GET /headers' ] }
};

let base = context('http://localhost:8232');

let app;

const authProvider = new AppServer({ port: 8060, log: false });
authProvider.api(
    ({ post, get }) => {
        post('/auth', ({ res, body }) => {
            if(body)
                return res.status(400).end();
            res.end('ID: ' + uuid());
        });

        get('/headers', ({ headers, res }) => {
            res.json(headers);
        });
    }
);

before(async function(){
    await authProvider.start();
});

after(async function(){
    await authProvider.stop();
});

beforeEach(async function(){
    app = init();
    app.setup({
        port: 8232,
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

    it('Should fail when cannot connect to redis', function(){
        app.setup({ redis: { port: 8676 } });
        assert.rejects(() => app.restart(), /Redis connection/);
    });


    describe('Services', function(){

        it('Should fail when endpoint has invalid method name', function(){
            let obj = { services: { foo: { url: 'test', endpoints: [ 'FOO /bar' ] } } };
            assert.throws( () => app.setup(obj), /method name/ );
        });

        it('Should fail if serivce has unsupported keys', function(){
            let obj = { services: { foo: { bar: 'baz' } } };
            assert.throws( () => app.setup(obj), /key 'bar'/ );
        });

        it('Should fail if serivce has no endpoints', function(){
            let obj = { services: { foo: { } } };
            assert.throws( () => app.setup(obj), /least 1 endpoint/ );
        });

    });

});

describe('API', function(){

    describe('Endpoints', function(){

        it('Should fail when service doesn\'t exist', async function(){
            let { assert } = await base.get('nothing');
            assert.status.is(404);
        });

        it('Should fail when service is unresponsive', async function(){
            this.timeout(2700);
            let { assert } = await base.get('unresponsive/foo');
            assert.status.is(503);
        });

        it('Should fail when endpoint doesn\'t exist', async function(){
            let { assert } = await base.get('unresponsive/foo2');
            assert.status.is(404);
        });

        it('Should reach an exposed service endpoints', async function(){
            let { assert } = await base.get('backend/headers');
            assert.status.is(200);
            assert.body.contains('date');
        });

        it('Should preserve cookies from outside when setup [proxy.preserveCookies]', async function(){
            await app.restart({ proxy: { preserveCookies: true } });
            let { assert } = await base.get('backend/headers', { 'cookies': { foo: 'bar' } });
            assert.body.contains('"cookie":"foo=bar');
        });

        it('Should support WebSocket connection', function(done){
            let count = 0;

            const WebSocket = require('ws');
            let wss = new WebSocket.Server({ port: 1234 });
            wss.on('connection', client => {

                client.on('message', message => {
                    count++;
                    assert.strictEqual(message, 'foobar');
                    client.send('bahbaz');
                });

                client.on('close', () => {
                    assert.strictEqual(count, 4);
                    wss.close();
                    done();
                });

                count++;
            });

            let wsc = new WebSocket('http://localhost:8232/ws/ws');
            wsc.on('open', () => {
                count++;
                wsc.send('foobar');
            });
            wsc.on('message', m => {
                count++;
                assert.strictEqual(m, 'bahbaz');
                wsc.close();
            });

        });

    });

    describe('POST /login', function(){

        it('Should fail when can\'t reach auth server', async function(){
            this.timeout(2700);
            await app.restart({ auth: { url: 'http://nothing' } });
            let { assert } = await base.post('login');
            assert.status.is(500);
        });

        it('Should return authentication failure when not 200', async function(){
            let { assert } = await base.post('login', 'must fail');
            assert.status.is(400);
        });

        it('Should return ok when auth succeeds', async function(){
            let { assert } = await base.post('login');
            assert.status.is(200);
        });

    });

    describe('POST /logout', function(){

        it('Should force expire an active session', async function(){
            await app.restart({ session: { timeout: '1d' }, cookie: { secure: false } });
            let { cookies } = await base.post('login');
            let { headers } = await base.post('logout', { cookies });
            assert(headers['set-cookie'][0].indexOf('01 Jan 1970') > 0);
        });

    });

});

describe('Settings', function(){

    it('Should create signed cookie when auth succeeds [cookie.name]', async function(){
        await app.restart({ cookie: { name: 'foobar' } });
        let { cookies } = await base.post('login');
        assert.strictEqual(cookies.foobar.charAt(0), 's');
    });

    it('Should add setup header when proxying after auth [cookie.*][proxy.claimHeader]', async function(){
        await app.restart({ proxy: { claimHeader: 'X-Foo' }, cookie: { secure: false } });
        let { cookies } = await base.post('login');
        let { assert } = await base.get('backend/headers', { cookies });
        assert.body.contains('"x-foo":');
    });

    it('Should expire auth data after the setup timeout [session.timeout]', async function(){
        await app.restart({ session: { timeout: '1s' }, cookie: { secure: false } });
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
