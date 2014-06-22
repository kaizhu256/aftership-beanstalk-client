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
