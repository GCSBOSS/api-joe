const Session = require('./session');
const { installServices } = require('./services');

module.exports = function(methods){

    this.cookieSecret = this.settings.signatureSecret;

    if(this.settings.services)
        installServices(methods, this.settings.services);

    let { post } = methods;

    post('/login', Session.create);
    post('/logout', Session.match, Session.destroy);
}
