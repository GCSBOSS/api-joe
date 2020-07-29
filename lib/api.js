const Session = require('./session');
const { installServices } = require('./services');

module.exports = function(methods){

    if(this.conf.services)
        installServices(methods, this.conf.services);

    let { post } = methods;

    post('/login', Session.create);
    post('/logout', Session.match, Session.destroy);
}
