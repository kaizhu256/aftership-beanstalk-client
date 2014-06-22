aftership-beanstalk-client [![travis.ci-org build status](https://api.travis-ci.org/kaizhu256/aftership-beanstalk-client.svg?branch=unstable)](https://travis-ci.org/kaizhu256/aftership-beanstalk-client?branch=unstable)
==========================
aftership beanstalk client

## quickstart
```
git clone git@github.com:kaizhu256/aftership-beanstalk-client.git
cd aftership-beanstalk-client
## npm install fivebeans and other dependencies
npm install
## start a consumer listening to beanstalk server on localhost:11300
npm start --host=localhost --port=11300
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
