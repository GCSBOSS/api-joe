const forge = require('node-forge');
const acme = require('acme-client');
const tls = require('tls');

function getSelfSignedCert(domain){

    let { privateKey, publicKey } = forge.pki.rsa.generateKeyPair(2048);
    let cert = forge.pki.createCertificate();

    cert.publicKey = publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(new Date().getFullYear() + 1);

    var attrs = [
        { name: 'commonName', value: domain },
        { name: 'countryName', value: 'US' },
        { shortName: 'ST', value: 'New York' },
        { name: 'localityName', value: 'New York' },
        { name: 'organizationName', value: 'API Joe Standard Certificate' },
        { shortName: 'OU', value: 'API Joe Self-Signed Certificate' }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(privateKey);

    let expirey = cert.validity.notAfter;
    expirey.setDate(expirey.getDate() - 3);

    return {
        key: forge.pki.privateKeyToPem(privateKey),
        cert: forge.pki.certificateToPem(cert),
        expirey
    };
}

function createContext({ cert, key, expirey }){
    let ctx = tls.createSecureContext({ key, cert });
    ctx.expireAt = expirey;
    return ctx;
}

function isContextStillValid(pool, domain){
    return domain in pool && pool[domain].expireAt > new Date();
}

function challengeCreate(authz, { /*type,*/ token }, keyAuthorization) {
    //if(type === 'http-01'){
    this.global.redis.set('joe:challenges:' + token, keyAuthorization);
    this.log.debug({ type: 'acme' }, 'Created challenge %s', token);
}

async function challengeRemove(authz, { /*type,*/ token }) {
    //if(type === 'http-01'){
    let r = await this.global.redis.del('joe:challenges:' + token);
    r && this.log.debug({ type: 'acme' }, 'Removed challenge %s', token);
}

module.exports = {

    async replyChallenge(req, res){
        // TODO HTTP/S redirect in case it's a valid call or similar

        let token = req.url.substr(28);
        let key = await this.redis.get('joe:challenges:' + token);

        /* istanbul ignore next */
        if(!key || req.url.indexOf('/.well-known/acme-challenge/') !== 0){
            res.statusCode = 404;
            res.end();
            return;
        }
        res.end(key);
    },

    async SNICallback(domain, cb){
        // this => app

        // TODO IS DOMAIN A SERVICE ?

        // TODO IS this needed due to when SNICallback is called?
        if(isContextStillValid(this.global.contexts, domain))
            return cb(null, this.global.contexts[domain]);

        var data = await this.global.redis.hgetall('joe:domains:' + domain);

        if(!data){
            const [ key, csr ] = await acme.forge.createCsr({
                commonName: domain
            });

            data = { key };

            try{
                data.cert = await this.global.acmeClient.auto({
                    csr, email: this.conf.acme.email,
                    termsOfServiceAgreed: true,
                    skipChallengeVerification: true,
                    challengeCreateFn: challengeCreate.bind(this),
                    challengeRemoveFn: challengeRemove.bind(this)
                });

                this.log.info({ type: 'acme' }, 'Generated new cert for %s', domain);

                let info = await acme.forge.readCertificateInfo(data.cert);
                data.expirey = info.notAfter;
                data.expirey.setDate(data.expirey.getDate() - 3);

                this.global.redis.hset('joe:domains:' + domain, 'cert', data.cert);
                this.global.redis.hset('joe:domains:' + domain, 'key', data.key);
                this.global.redis.hset('joe:domains:' + domain, 'expirey', data.expirey);
                this.global.redis.expireat('joe:domains:' + domain, data.expirey.getTime());
            }
            catch(err){
                data = getSelfSignedCert(domain);
                this.log.warn({ err, type: 'acme', domain });
            }
        }
        let ctx = createContext(data);
        this.global.contexts[domain] = ctx;
        cb(null, ctx);
    }


};
