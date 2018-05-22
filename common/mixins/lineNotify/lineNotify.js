'use strict';
const axios = require('axios');
const qs = require('qs');
module.exports = function(Model, options) {
  options.backendUrl = options.backendUrl || 'http://localhost:3000';
  options.clientUrl = options.clientUrl || 'http://localhost:3000';
  options.backendCallbackPath = options.backendCallbackPath || '/lineNotify/callback';
  options.successCallbackPath = options.successCallbackPath || '/lineNotify/success';
  options.errorCallbackPath = options.errorCallbackPath || '/lineNotify/fail';

  function getConfig() {
    const app = Model.app;
    const backendUrl = options.backendUrl;
    const clientUrl = options.clientUrl;
    const backendCallbackPath = options.backendCallbackPath;
    const successCallbackPath = options.successCallbackPath;
    const errorCallbackPath = options.errorCallbackPath;
    const lineClientID = options.lineClientID;
    const lineClientSecret = options.lineClientSecret;
    const sessionKey = `${Model.name}Id`;
    const redirectURL = (`${backendUrl}${app.get('restApiRoot')}/${Model.pluralModelName}${backendCallbackPath}`).toLowerCase();
    return {
      app,
      backendUrl,
      clientUrl,
      backendCallbackPath,
      successCallbackPath,
      errorCallbackPath,
      lineClientID,
      lineClientSecret,
      sessionKey,
      redirectURL,
    };
  }
  Model.defineProperty('lineNotifyToken', {type: String});
  // Model.prototype.linkLineNotify = function(msg, cb) {
  //   cb(null, 'Greetings... ' + msg);
  // };
  Model.remoteMethod('prototype.linkLineNotify', {
    accepts: [{
      arg: 'req',
      type: 'object',
      http: {
        source: 'req',
      },
    },
    {
      arg: 'res',
      type: 'object',
      http: {
        source: 'res',
      },
    }],
    returns: [],
    http: [
      {
        verb: 'get',
      },
    ],
  });
  Model.remoteMethod('lineCallback', {
    accepts: [{
      arg: 'req',
      type: 'object',
      http: {
        source: 'req',
      },
    },
    {
      arg: 'res',
      type: 'object',
      http: {
        source: 'res',
      },
    }],
    returns: [],
    http: [
      {
        path: options.backendCallbackPath,
        verb: 'get',
      },
    ],
  });
  function generateLineAuthURL(req) {
    function encodeQueryData(data) {
      const ret = Object.keys(data).map(d => `${encodeURIComponent(d)}=${encodeURIComponent(data[d])}`);
      return ret.join('&');
    }
    const {redirectURL} = getConfig();
    const query = {
      response_type: 'code',
      client_id: 'cfF3prlw3wuNKXA5RfO71w',
      redirect_uri: redirectURL,
      scope: 'notify',
      state: req.sessionId,
    };
    return `https://notify-bot.line.me/oauth/authorize?${encodeQueryData(query)}`;
  }
  Model.prototype.linkLineNotify = function(req, res, options) {
    // TODO
    const {sessionKey} = getConfig();
    const url = generateLineAuthURL(req);
    req.session[sessionKey] = this.id;
    return res.redirect(url);
  };
  Model.lineCallback = async function(req, res) {
    const {redirectURL, lineClientID, lineClientSecret, clientUrl, successCallbackPath, errorCallbackPath, sessionKey} = getConfig();
    const {code} = req.query;
    const data = {
      'grant_type': 'authorization_code',
      code,
      'redirect_uri': redirectURL,
      'client_id': lineClientID,
      'client_secret': lineClientSecret,
    };
    const _options = {
      method: 'POST',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      data: qs.stringify(data),
      url: 'https://notify-bot.line.me/oauth/token',
    };
    try {
      const result = await axios(_options);
      // console.log(result);
      const _model = await Model.findById(req.session[sessionKey]);
      _model.lineNotifyToken = result.data.access_token;
      await _model.save();
      return res.redirect(`${clientUrl}${successCallbackPath}`);
    } catch (e) {
      console.log(e);
      return res.redirect(`${clientUrl}${errorCallbackPath}`);
    }
  };
  Model.prototype.lineNotify = async function(msg) {
    // console.log(req);
    if (!this.lineNotifyToken) {
      return Promise.resolve();
    }
    const data = {
      'message': msg,
    };
    const _options = {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${this.lineNotifyToken}`,
      },
      data: qs.stringify(data),
      url: 'https://notify-api.line.me/api/notify',
    };
    try {
      const result = await axios(_options);
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.reject(e);
    }
  };
};
