/*jslint indent:2, nomen: true, regexp: true, stupid: true*/
/* eval(require('fs').readFileSync('consumer.js', 'utf8')) */
(function () {
  'use strict';
  var local = {
    /* config setting */
    config: {
      /* default timeout for http requests */
      timeout: 30000
    },

    init: function () {
      local.initConsumer();
      // local.initProducer();
    },

    initConsumer: function () {
      var consumer;
      consumer = new local.requiredFivebeans.client('127.0.0.1', 11300);
      consumer
        .on('connect', function () {
          // consumer can now be used
          return;
        })
        .on('error', function (err) {
          // connection failure
          local.nop(err);
          return;
        })
        .on('close', function () {
          // underlying connection has closed
          return;
        })
        .connect();
      consumer.reserve(function (err, jobid, payload) {
        local.consumerHandler(err, jobid, payload, consumer);
      });
    },

    consumerHandler: function (err, jobid, payload, consumer) {
      var mode, onEventError2;
      mode = 0;
      onEventError2 = function (error, data) {
        mode = error instanceof Error ? -1 : mode + 1;
        switch (mode) {
        case 1:
          /* JSON.parse payload with error handling */
          try {
            payload = JSON.parse(payload.toString());
          } catch (error2) {
            onEventError2(error2);
            return;
          }
          // debug
          console.log('consumer reserve', [err, jobid, payload]);
          /* request url */
          local.httpRequest({
            url: payload.url
          }, onEventError2);
          break;
        case 2:
          data = data.toString();
          // debug
          // console.log('consumer data', data);
          onEventError2();
          break;
        default:
          consumer.destroy(jobid, function (err) {
            console.log('consumer err', err);
          });
          /* auto consume next job */
          local.initConsumer();
        }
      };
      onEventError2(err);
    },

    initProducer: function () {
      var producer;
      producer = new local.requiredFivebeans.client('127.0.0.1', 11300);
      producer
        .on('connect', function () {
          // producer can now be used
          return;
        })
        .on('error', function (err) {
          // connection failure
          local.nop(err);
          return;
        })
        .on('close', function () {
          // underlying connection has closed
          return;
        })
        .connect();
      producer.put(1000, 1, 1, JSON.stringify({
        url: 'https://www.google.com/?gws_rd=ssl#q=aa'
      }), function (err, jobid) {
        console.log('producer', [err, jobid]);
      });
    },

    nop: function () {
      /*
        this function performs no operation (nop)
      */
      return;
    },

    /* require fs */
    requiredFs: require('fs'),
    /* require http */
    requiredHttp: require('http'),
    /* require https */
    requiredHttps: require('https'),
    /* require url */
    requiredUrl: require('url'),
    /* require fivebeans */
    requiredFivebeans: require('fivebeans'),

    httpRequest: function (options, onEventError) {
      /*
        this functions performs an asynchronous http(s) request with error handling and timeout
      */
      var onEventError2, request, response, timeout, urlParsed;
      onEventError2 = function (error, data, headers) {
        /* clear timeout */
        clearTimeout(timeout);
        if (error) {
          /* garbage collect request socket */
          if (request) {
            request.destroy();
          }
          /* garbage collect response socket */
          if (response) {
            response.destroy();
          }
        }
        onEventError(error, data, headers);
      };
      /* set timeout */
      timeout = setTimeout(function () {
        onEventError2(new Error('timeout'));
      }, local.config.timeout);
      /* parse options.url */
      urlParsed = local.requiredUrl.parse(options.url);
      /* bug - disable socket pooling, because it causes timeout errors in tls tests */
      options.agent = options.agent || false;
      /* host needed for redirects */
      options.host = urlParsed.host;
      /* hostname needed for http(s).request */
      options.hostname = urlParsed.hostname;
      /* path needed for http(s).request */
      options.path = urlParsed.path;
      /* port needed for http(s).request */
      options.port = urlParsed.port;
      /* protocol needed for http(s).request */
      options.protocol = urlParsed.protocol;
      request = (options.protocol === 'https:' ? local.requiredHttps : local.requiredHttp)
        .request(options, function (_) {
          response = _;
          /* error handling */
          response.on('error', onEventError2);
          /* follow redirects */
          switch (response.statusCode) {
          case 301:
          case 302:
          case 303:
          case 304:
          case 305:
          case 306:
          case 307:
            options.redirected = options.redirected || 0;
            options.redirected += 1;
            if (options.redirected >= 8) {
              onEventError2(new Error('ajaxNodejs - too many http redirects to ' +
                response.headers.location));
              return;
            }
            options.url = response.headers.location;
            if (options.url && options.url[0] === '/') {
              options.url = options.protocol + '//' + options.host + options.url;
            }
            local.httpRequest(options, onEventError2);
            return;
          }
          /* get responseText */
          local.streamReadAll(
            response.on('error', onEventError2),
            function (error, data) {
              /* error handling */
              if (error) {
                onEventError2(error);
                return;
              }
              /* error handling for status code >= 400 */
              if (options.responseStatusCode >= 400) {
                onEventError2(new Error(data.toString()));
                return;
              }
              /* successful response */
              onEventError2(null, data, response.headers);
            }
          );
        });
      /* send request and / or data */
      request.end(options.data);
    },

    streamReadAll: function (readableStream, onEventError) {
      /*
        this function concats data from readable stream and passes it to callback when done
      */
      var chunks;
      chunks = [];
      /* read data from readable stream */
      readableStream.on('data', function (chunk) {
        chunks.push(chunk);
      /* call callback when finished reading */
      }).on('end', function () {
        onEventError(null, Buffer.concat(chunks));
      /* pass any errors to the callback */
      }).on('error', onEventError);
    }

  };
  local.init();
}());

