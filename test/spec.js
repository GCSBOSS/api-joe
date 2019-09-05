const assert = require('assert');
const { context } = require('muhb');

const init = require('../lib/main');

const HTTPBIN_URL = process.env.HTTPBIN_URL || 'http://localhost:8066';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const SERVICES = {
    unresponsive: { url: 'http://anything', endpoints: [ 'GET /foo' ] },
    httpbin: { url: HTTPBIN_URL, endpoints: [ 'GET /get', 'GET /anything' ] }
};

let base = context('http://localhost:8232');

let app;

beforeEach(async function(){
    app = init();
    app.setup({
        port: 8232,
        redis: { host: REDIS_HOST },
        cookie: { name: 'foobaz' },
        services: SERVICES,
        auth: { url: HTTPBIN_URL + '/post' }
    });
    await app.start();
});

afterEach(async function(){
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
            let { assert } = await base.get('httpbin/get');
            assert.status.is(200);
            assert.body.contains('/get');
        });

        it('Should preserve cookies from outside when setup [proxy.preserveCookies]', async function(){
            await app.restart({ proxy: { preserveCookies: true } });
            let { assert } = await base.get('httpbin/get', { 'cookies': { foo: 'bar' } });
            assert.body.contains('"Cookie": "foo=bar');
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
            await app.restart({ auth: { url: HTTPBIN_URL + '/get' } });
            let { assert } = await base.post('login');
            assert.status.is(400);
        });

        it('Should return ok when auth succeeds', async function(){
            let { assert } = await base.post('login', 'some raw data');
            assert.status.is(200);
        });

    });

    describe('POST /logout', function(){

        it('Should force expire an active session', async function(){
            await app.restart({ session: { timeout: '1d' }, cookie: { secure: false } });
            let { cookies } = await base.post('login', 'some raw data');
            let { headers } = await base.post('logout', { cookies });
            assert(headers['set-cookie'][0].indexOf('01 Jan 1970') > 0);
        });

    });

});

describe('Settings', function(){

    it('Should create signed cookie when succeeds [cookie.name]', async function(){
        await app.restart({ cookie: { name: 'foobar' } });
        let { cookies } = await base.post('login');
        assert.strictEqual(cookies.foobar.charAt(0), 's');
    });

    it('Should add setup header when proxying after auth [cookie.*][proxy.claimHeader]', async function(){
        await app.restart({ proxy: { claimHeader: 'X-Foo' }, cookie: { secure: false } });
        let { cookies } = await base.post('login');
        let { assert } = await base.get('httpbin/anything', { cookies });
        assert.body.contains('"X-Foo":');
    });

    it('Should expire auth data after the setup timeout [session.timeout]', async function(){
        await app.restart({ session: { timeout: '1s' }, cookie: { secure: false } });
        let { cookies } = await base.post('login', 'some raw data');
        await new Promise(done => setTimeout(done, 1500));
        let { body } = await base.get('httpbin/anything', { cookies });
        assert(body.indexOf('X-Claim') < 0);
    });

});
