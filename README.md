aftership-beanstalk-client [![travis.ci-org build status](https://api.travis-ci.org/kaizhu256/aftership-beanstalk-client.svg?branch=unstable)](https://travis-ci.org/kaizhu256/aftership-beanstalk-client?branch=unstable)
==========================
aftership beanstalk client

## quickstart
```
git clone git@github.com:kaizhu256/aftership-beanstalk-client.git
cd aftership-beanstalk-client
## npm install fivebeans and other dependencies
npm install
## start a consumer listening to a beanstalk server on localhost:11300
npm start --host=localhost --port=11300
```

## library usage
```
/* example.js */
/*jslint indent:2*/
(function () {
  'use strict';
  var aftership_beanstalk_client, consumer, fivebeans, host, port;
  /* require aftership_beanstalk_client */
  aftership_beanstalk_client = require('./aftership-beanstalk-client.js');
  /* require fivebeans */
  fivebeans = require('fivebeans');
  /* init host var */
  host = 'localhost';
  /* init port var */
  port = 11300;
  /* create new beanstalk consumer */
  consumer = new fivebeans.client(host, port);
  consumer
    .on('connect', function () {
      /* consumer can now be used */
      console.log('connected to beanstalk server ' + host + ':' + port);
      return;
    })
    .on('error', function (error) {
      /* connection failure */
      console.error(error);
      return;
    })
    .on('close', function () {
      /* underlying connection has closed */
      return;
    })
    .connect();
  /* add aftership_beanstalk_client.beanstalkConsumerHandler to consumer.reserve */
  consumer.reserve(function (error, jobId, payload) {
    console.log('processing job ' + jobId + ' ' +
      JSON.stringify(payload && payload.toString()));
    aftership_beanstalk_client.beanstalkConsumerHandler(error, jobId, payload, consumer);
  });
}());
```

## todo
- include order increment_id in tracking info
- add retries to timeout handling

## changelog
#### 2014.6.22
- integrate consumer into beanstalkd
- implement pagination in consumer for shipping list
- setup automated travis-ci build
- setup encryption mechanism

## admin
- [edit README.md](https://github.com/kaizhu256/aftership-beanstalk-client/edit/unstable/README.md)
- counter 5
