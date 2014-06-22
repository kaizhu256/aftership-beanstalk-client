/*jslint indent:2, nomen: true, regexp: true, stupid: true*/
/* declare global vars */
var exports, required, state;



(function moduleInitNodejs() {
  /*
    this nodejs module runs init code
  */
  'use strict';
  var local = {
    _name: 'beanstalk.moduleInitNodejs',

    _init: function () {
      /* init exports object */
      exports = module.exports = {};
      /* init required object */
      required = {
        fivebeans: require('fivebeans'),
        fs: require('fs'),
        http: require('http'),
        https: require('https'),
        url: require('url')
      };
      /* init state object */
      state = {
        testReport: {
          /* list of tests to run */
          testCaseList: [],
          testsFailed: 0,
          testsPassed: 0,
          totalTime: 0
        },
        /* default timeout for http request and other async io */
        timeoutDefault: 30000
      };
      /* init debug print */
      global[['debug', 'Print'].join('')] = function (arg) {
        /*
          this internal function is used for tmp debugging,
          and jslint will nag you to remove it if used
        */
        console.error('\n\n\ndebug' + 'Print');
        console.error.apply(console, arguments);
        console.error();
        /* return arg for inspection */
        return arg;
      };
      /* init debug onEventError */
      global.onEventError = local.onEventErrorDefault;
      local.initLocal(local);
      /* start client */
      setTimeout(local._initStart);
      /* init async tests after this module has been loaded */
      setTimeout(local._initTest);
      /* init state.aftershipMagentoEndpointLoginList */
      try {
        state.aftershipMagentoEndpointLoginList =
          JSON.parse(process.env.AFTERSHIP_MAGENTO_ENDPOINT_LOGIN_LIST);
      } catch (error) {
        state.aftershipMagentoEndpointLoginList = [];
      }
    },

    _initStart: function () {
      /*
        this function inits npm start
      */
      var consumer, host, port;
      if (process.argv.indexOf('--mode-start') < 0) {
        return;
      }
      host = process.env.npm_config_host || 'localhost';
      port = process.env.npm_config_port || 11300;
      consumer = new required.fivebeans.client(host, port);
      consumer
        .on('connect', function () {
          /* consumer can now be used */
          console.log('connected to beanstalk server ' + host + ':' + port);
          return;
        })
        .on('error', function (error) {
          /* connection failure */
          exports.onEventErrorDefault(error);
          return;
        })
        .on('close', function () {
          /* underlying connection has closed */
          return;
        })
        .connect();
      consumer.reserve(function (error, jobId, payload) {
        console.log('processing job ' + jobId + ' ' +
          JSON.stringify(payload && payload.toString()));
        exports.beanstalkConsumerHandler(error, jobId, payload, consumer);
      });
    },

    _initTest: function () {
      /*
        this function inits npm test
      */
      var remaining, testReport;
      if (process.argv.indexOf('--mode-test') < 0) {
        return;
      }
      testReport = state.testReport;
      remaining = testReport.testCaseList.length;
      /* start global test timer */
      testReport.totalTime = Date.now();
      testReport.testCaseList.forEach(function (testCase) {
        var errorFinished, finished, onEventError;
        errorFinished = new Error('testCase ' + testCase.name + ' called multiple times');
        onEventError = function (error) {
          exports.onEventErrorDefault(error);
          /* save test error */
          testCase.error = testCase.error || error;
          /* error - multiple callbacks in test case */
          if (finished) {
            exports.onEventErrorDefault(errorFinished);
            /* save test error */
            testCase.error = testCase.error || errorFinished;
            return;
          }
          finished = true;
          /* save test time */
          testCase.time = Date.now() - testCase.time;
          /* decrement test counter */
          remaining -= 1;
          /* generate test report when all tests have finished */
          if (remaining === 0) {
            /* stop global test timer */
            testReport.totalTime = Date.now() - testReport.totalTime;
            local._testReportGenerate(testReport);
          }
        };
        testCase.time = Date.now();
        /* run test case in try-catch block */
        try {
          testCase.callback(onEventError);
        } catch (error) {
          onEventError(error);
        }
      });
    },

    _testReportGenerate: function (testReport) {
      /*
        this function generates a test report after all tests have finished
      */
      var result;
      testReport.testCaseList.forEach(function (testCase) {
        if (testCase.error) {
          testReport.testsFailed += 1;
        } else {
          testReport.testsPassed += 1;
        }
        console.log();
      });
      result = '\n\n\ntest report\n';
      result += ('        ' + testReport.totalTime).slice(-8) + ' ms | ' +
          (' ' + testReport.testsFailed).slice(-2) + ' failed | ' +
          ('  ' + testReport.testsPassed).slice(-3) + ' passed';
      console.log(result);
      /* non-zero exit if tests failed */
      if (testReport.testsFailed > 0) {
        process.exit(1);
      }
    },

    httpRequest: function (options, onEventError) {
      /*
        this functions performs an asynchronous http(s) request with error handling and timeout,
        and passes the responseText to onEventError
      */
      var finished,
        mode,
        onEventError2,
        redirect,
        request,
        response,
        responseText,
        timeout,
        urlParsed;
      mode = 0;
      onEventError2 = function (error, data) {
        mode = error instanceof Error ? -1 : mode + 1;
        switch (mode) {
        case 1:
          /* clear old timeout */
          clearTimeout(timeout);
          /* set timeout */
          timeout = exports.onEventTimeout(
            onEventError2,
            state.timeoutDefault,
            'httpRequest ' + options.url
          );
          /* parse options.url */
          urlParsed = required.url.parse(options.url);
          /* deep-copy object */
          options = JSON.parse(JSON.stringify(options));
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
          /* init headers */
          options.headers = options.headers || {};
          /* init Content-Length header */
          options.headers['Content-Length'] =
            options.data ? Buffer.byteLength(options.data) : 0;
          request = (options.protocol === 'https:' ? required.https : required.http)
            .request(options, onEventError2);
          /* send request and / or data */
          request.end(options.data);
          break;
        case 2:
          response = error;
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
            mode = -2;
            redirect = true;
            onEventError2();
            return;
          }
          /* concat responseText from response stream */
          exports.streamReadAll(response, onEventError2);
          break;
        case 3:
          /* stringify responseText */
          responseText = data.toString();
          /* error handling for http status code >= 400 */
          if (options.responseStatusCode >= 400) {
            onEventError2(new Error(responseText));
            return;
          }
          /* successful response */
          onEventError2(null, responseText, response);
          break;
        default:
          /* clear timeout */
          clearTimeout(timeout);
          /* garbage collect request socket */
          if (request) {
            request.destroy();
          }
          /* garbage collect response socket */
          if (response) {
            response.destroy();
          }
          if (!finished) {
            finished = true;
            if (error) {
              /* add http method / status / url debug info to error.message */
              error.message = options.method + ' ' + (response && response.statusCode) + ' - ' +
                options.url + '\n' +
                JSON.stringify((responseText || '').slice(0, 256) + '...') + '\n' +
                error.message;
              /* update error.stack with error message */
              error.stack = error.message + '\n' + error.stack;
              onEventError(error, responseText, response);
            }
            if (redirect) {
              options.redirected = options.redirected || 8;
              options.redirected -= 1;
              if (options.redirected < 0) {
                onEventError2(new Error('httpRequest - too many http redirects to ' +
                  response.headers.location));
                return;
              }
              options.url = response.headers.location;
              if (options.url && options.url[0] === '/') {
                options.url = options.protocol + '//' + options.host + options.url;
              }
              exports.httpRequest(options, onEventError);
              return;
            }
            try {
              /* try to call onEventError with responseText */
              onEventError(null, responseText, response);
            } catch (error2) {
              /* else call onEventError with caught error */
              onEventError(error2, responseText, response);
            }
          }
        }
      };
      onEventError2();
    },

    initLocal: function (local) {
      /*
        this function inits a module's local object
      */
      Object.keys(local).forEach(function (key) {
        /* add test case */
        if (key.slice(-5) === '_test') {
          state.testReport.testCaseList.push({
            callback: local[key],
            name: local._module + '.' + key
          });
        /* export items that don't start with an underscore _ */
        } else if (key[0] !== '_') {
          exports[key] = local[key];
        }
      });
    },

    onEventErrorDefault: function (error, data) {
      /*
        this function provides a default, error / data handling callback.
        if an error is given, it will print the error's message and stack,
        else it will print the data
      */
      if (error) {
        if (typeof error === 'string') {
          error = new Error(error);
        }
        /* print error */
        console.error('\nonEventErrorDefault - error\n' + error.stack + '\n');
      /* print data if it's defined and not an empty string */
      } else if (data !== undefined && data !== '') {
        /* debug data */
        console.log('\nonEventErrorDefault - data\n' + JSON.stringify(data, null, 2) + '\n');
      }
    },

    onEventTimeout: function (onEventError, timeout, message) {
      /*
        this function sets a timer to throw and handle a timeout error
      */
      var error;
      error = new Error('onEventTimeout - timeout error - ' + timeout + ' ms - ' + message);
      error.code = 'ETIMEDOUT';
      return setTimeout(function () {
        onEventError(error);
      }, timeout);
    },

    nop: function () {
      /*
        this function performs no operation (nop)
      */
      return;
    },

    streamReadAll: function (readableStream, onEventError) {
      /*
        this function concats data from readableStream and passes it to onEventError when done
      */
      var chunks;
      chunks = [];
      /* read data from readableStream */
      readableStream.on('data', function (chunk) {
        chunks.push(chunk);
      /* call callback when finished reading */
      }).on('end', function () {
        onEventError(null, Buffer.concat(chunks));
      /* pass any errors to the callback */
      }).on('error', onEventError);
    }

  };
  local._init();
}());



(function moduleMagentoNodejs() {
  /*
    this nodejs module exports the magento api
  */
  'use strict';
  var local = {
    _name: 'beanstalk.moduleMagentoNodejs',

    _init: function () {
      exports.initLocal(local);
    },

    beanstalkConsumerHandler: function (error, jobId, payload, consumer) {
      /*
        this function handles beanstalk consumption of the magento endpoint url
      */
      var mode, options, onEventError2;
      mode = 0;
      onEventError2 = function (error, data) {
        mode = error instanceof Error ? -1 : mode + 1;
        switch (mode) {
        case 1:
          if (!payload) {
            onEventError2();
            return;
          }
          /* JSON.parse payload with error handling */
          try {
            options = JSON.parse(payload);
          } catch (error2) {
            onEventError2(error2);
            return;
          }
          /* pass options to magentoSalesOrderShippingListPaginate */
          exports.magentoSalesOrderShippingListPaginate(options, onEventError2);
          break;
        case 2:
          /* print data to stdout */
          console.log(options.url + '\n' + JSON.stringify(data, null, 2));
          onEventError2();
          break;
        default:
          /* if error then bury the job */
          if (error) {
            exports.onEventErrorDefault(error);
            consumer.bury(jobId, 1000, exports.onEventErrorDefault);
          } else {
            /* else destroy old job */
            consumer.destroy(jobId, exports.onEventErrorDefault);
            /* if options.salesOrderShippingList is not empty, then re-queue it */
            if (options &&
                options.salesOrderShippingList &&
                options.salesOrderShippingList.length > 0) {
              /* reset options but preserve salesOrderShippingList */
              options = {
                domain: options.domain,
                key: options.key,
                salesOrderShippingList: options.salesOrderShippingList,
                username: options.username
              };
              console.log('\nre-queue unfinished job ' + JSON.stringify(options));
              consumer.put(1000, 1, 1, JSON.stringify(options), exports.onEventErrorDefault);
            }
          }
          /* auto-reserve next job */
          consumer.reserve(function (error, jobId, payload) {
            exports.beanstalkConsumerHandler(error, jobId, payload, consumer);
          });
        }
      };
      onEventError2(error);
    },

    magentoSessionEnd: function (options, onEventError) {
      /*
        this function ends the magento session and expires options.sessionToken
      */
      options.data = '<?xml version="1.0"?>' +
        '<methodCall><methodName>endSession</methodName><params>' +
        '<param><value><string>' + options.sessionToken + '</string></value></param>' +
        '</params></methodCall>';
      exports.httpRequest(options, onEventError);
    },

    magentoSessionStart: function (options, onEventError) {
      /*
        this function starts a magento session inits options.sessionToken
      */
      options.data = '<?xml version="1.0"?>' +
        '<methodCall><methodName>login</methodName><params>' +
        '<param><value><string>' + options.username + '</string></value></param>' +
        '<param><value><string>' + options.key + '</string></value></param>' +
        '</params></methodCall>';
      options.method = 'POST';
      options.url = 'http://' + options.domain + '/api/xmlrpc';
      /* login and fetch sessionToken */
      exports.httpRequest(options, function (error, data) {
        if (error) {
          /* add extra debug info to error.message */
          error.message = JSON.stringify((data || '').slice(0, 256) + '...') + '\n' +
            error.message;
          /* update error.stack with error message */
          error.stack = error.message + '\n' + error.stack;
          onEventError(error);
          return;
        }
        /* init options.sessionToken */
        options.sessionToken = (/<string>(\w+)<\/string>/).exec(data)[1];
        onEventError();
      });
    },

    magentoSalesOrderShippingListPaginate: function (options, onEventError) {
      /*
        this function retrieves 100 results from options.salesOrderShippingList
      */
      var mode, onEventError2, tmp;
      mode = 0;
      onEventError2 = function (error, data) {
        mode = error instanceof Error ? -1 : mode + 1;
        switch (mode) {
        case 1:
          /* do nothing if options.salesOrderShippingList is empty */
          if (options.salesOrderShippingList && options.salesOrderShippingList.length === 0) {
            onEventError();
            return;
          }
          /* start magento session */
          exports.magentoSessionStart(options, onEventError2);
          break;
        case 2:
          /* if options.salesOrderShippingList exists, then skip the next 2 steps */
          if (options.salesOrderShippingList) {
            mode += 2;
            onEventError2();
          /* if options.salesOrderShippingList does not exist, then fetch it */
          } else {
            onEventError2();
          }
          break;
        case 3:
          /* fetch sales_order_shipment.list */
          options.data = '<?xml version="1.0"?>' +
            '<methodCall><methodName>call</methodName><params>' +
            '<param><value><string>' + options.sessionToken + '</string></value></param>' +
            '<param><value><string>sales_order_shipment.list</string></value></param>' +
            '</params></methodCall>';
          exports.httpRequest(options, onEventError2);
          break;
        case 4:
          /* parse sales_order_shipment.list */
          options.salesOrderShippingList = [];
          data.replace(
            (/<member><name>increment_id<\/name><value><string>([^<]+)/g),
            function (_, increment_id) {
              exports.nop(_);
              options.salesOrderShippingList.push(increment_id);
            }
          );
          /* sort sales_order_shipment.list by descending order */
          options.salesOrderShippingList.sort().reverse();
          onEventError2();
          break;
        case 5:
          /* multiCall the first 100 or less orders from options.salesOrderShippingList */
          tmp = options.salesOrderShippingList.splice(0, 100);
          console.log('fetching first 100 or less shipment items from ' + options.url + ' - ' +
            JSON.stringify(tmp));
          options.data = '<?xml version="1.0"?>' +
            '<methodCall><methodName>multiCall</methodName><params>' +
            '<param><value><string>' + options.sessionToken + '</string></value></param>' +
            '<param><value><array><data>' +
            /* splice first 100 or less orders from options.salesOrderShippingList */
            tmp.map(function (increment_id) {
              return '<value><array><data>' +
                '<value><string>sales_order_shipment.info</string></value>' +
                '<value><string>' + increment_id + '</string></value>' +
                '</data></array></value>';
            }).join('') +
            '</data></array></value></param>' +
            '</params></methodCall>';
          exports.httpRequest(options, onEventError2);
          break;
        case 6:
          /* parse tracked info */
          data = data
            /* split text into list of shipment tracks objects */
            .split('<name>tracks</name>')
            .slice(1)
            .map(function (trackInfo) {
              var dict;
              dict = {
                magentoApiKey: options.key,
                magentoApiUrl: options.url,
                magentoApiUser: options.username
              };
              trackInfo
                .split('</struct></value></data></array></value></member>')[0]
                .replace(
                  (/<member><name>([^<]+)<\/name><value><string>([^<]+)<\/string><\/value><\/member>/g),
                  function (_, key, value) {
                    exports.nop(_);
                    dict['salesOrderShipmentItemEntity_' + key] = value;
                  }
                );
              return dict;
            });
          onEventError2(null, data);
          break;
        default:
          /* end magento session */
          if (options.url && options.sessionToken) {
            exports.magentoSessionEnd(options, exports.nop);
          }
          if (error) {
            /* add extra error debug info */
            error.message = options.username + ' @ ' + options.url + '\n' + error.message;
            /* update error.stack with error message */
            error.stack = error.message + '\n' + error.stack;
          }
          /* debug */
          /* exports.onEventErrorDefault(error, data); */
          onEventError(error, data);
        }
      };
      onEventError2();
    },

    _magentoSalesOrderShippingListPaginate_test: function (onEventError) {
      /*
        this function tests _magentoSalesOrderShippingListPaginate's default handling behavior
      */
      exports.magentoSalesOrderShippingListPaginate(
        state.aftershipMagentoEndpointLoginList[0],
        function (error) {
          onEventError(error);
        }
      );
    }

  };
  local._init();
}());
