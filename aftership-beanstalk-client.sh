#!/bin/sh
shAesDecrypt() {
  ## this function decrypts base64-encode stdin to stdout using aes-256-cbc
  ## save stdin to $TEXT
  local TEXT=$(cat /dev/stdin)
  ## init $IV from first 44 base64-encoded bytes of $TEXT
  local IV=$(printf $TEXT | cut -c1-44 | base64 --decode)
  ## decrypt remaining base64-encoded bytes of $TEXT to stdout using aes-256-cbc
  printf $TEXT | cut -c45-9999 | base64 --decode | openssl enc -aes-256-cbc -d -K $AES_256_KEY -iv $IV
}

shAesDecryptTravis() {
  ## this function decrypts $AES_ENCRYPTED_SH in .travis.yml to stdout
  perl -ne "print \$2 if /(- AES_ENCRYPTED_SH: )(.*)( ## AES_ENCRYPTED_SH\$)/" .travis.yml\
    | shAesDecrypt\
    || return $?
}

shAesEncrypt() {
  ## this function encrypts stdin to base64-encode stdout,
  ## with a random iv prepended using aes-256-cbc
  ## init $IV from random 16 bytes
  local IV=$(openssl rand -hex 16)
  ## print base64-encoded $IV to stdout
  printf $(printf "$IV " | base64)
  ## encrypt stdin and stream to stdout using aes-256-cbc with base64-encoding
  openssl enc -aes-256-cbc -K $AES_256_KEY -iv $IV | base64 | tr -d "\n" || return $?
}

shAesEncryptTravis() {
  ## this function encrypts the script $1 to $AES_ENCRYPTED_SH and stores it in .travis.yml
  ## init $FILE
  local FILE=$1
  if [ ! -f "$FILE" ]
  then
    printf "## non-existent file $FILE\n"
    return 1
  fi
  if [ ! "$AES_256_KEY" ]
  then
    printf "## no \$AES_256_KEY detected in env - creating new AES_256_KEY ...\n"
    AES_256_KEY=$(openssl rand -hex 32)
    printf "## a new \$AES_256_KEY for encrypting data has been created.\n"
    printf "## you may want to copy the following to your .bashrc script\n"
    printf "## so you can run ci builds locally:\n"
    printf "export AES_256_KEY=$AES_256_KEY\n\n"
  fi
  printf "## travis-encrypting \$AES_256_KEY for $GITHUB_REPO ...\n"
  AES_256_KEY_ENCRYPTED=$(shTravisEncrypt $GITHUB_REPO \$AES_256_KEY=$AES_256_KEY)
  ## return non-zero exit code if $AES_256_KEY_ENCRYPTED is empty string
  if [ ! "$AES_256_KEY_ENCRYPTED" ]
  then
    return 1
  fi
  printf "## updating .travis.yml with encrypted key ...\n"
  perl -i -pe\
    "s%(- secure: )(.*)( ## AES_256_KEY$)%\$1$AES_256_KEY_ENCRYPTED\$3%"\
    .travis.yml\
    || return $?

  printf "## updating .travis.yml with encrypted script ...\n"
  perl -i -pe\
    "s%(- AES_ENCRYPTED_SH: )(.*)( ## AES_ENCRYPTED_SH$)%\$1$(shAesEncrypt < $FILE)\$3%"\
    .travis.yml\
    || return $?
}

shBuild() {
  ## this function builds the package on travis-ci.org
  npm test
}

shGitDeploy() {
  ## this function copies the app to /tmp/app with only the bare git repo files and public dir
  ## and then deploys it
  ## rm old /tmp/app
  rm -fr /tmp/app && mkdir -p /tmp/app || return $?
  ## tar / untar repo contents to /tmp/app, since we can't git clone a shallow repo
  git ls-tree -r HEAD --name-only | xargs tar -czf - | tar -C /tmp/app -xzvf - || return $?
  ## copy public dir
  cp -a public /tmp/app || return $?
  cd /tmp/app || return $?
  ## init .git and .git/config
  git init && cp $CWD/.install/git-config .git/config || return $?
  ## git commit /tmp/app
  rm -f .gitignore && git add . && git commit -am 'git deploy' || return $?
  ## git deploy
  git push -f $1 HEAD:$2 || return $?
}

shModuleEval() {
  ## this function evals the module $1
  local FILE=utility2.js2
  local MODULE=$1
  ## init $SCRIPT
  local SCRIPT="var ii, script; global.state = { modeModuleEval: true, modeNodejs: true };"
  SCRIPT="$SCRIPT var script = require('fs').readFileSync(\"$FILE\", 'utf8');"
  SCRIPT="$SCRIPT ii = script.indexOf('\\n(function $MODULE() {\\n');"
  ## preserve lineno
  SCRIPT="$SCRIPT script = script.slice(0, ii).replace(/.*/g, '') + script.slice(ii);"
  SCRIPT="$SCRIPT script = script.slice(0, script.indexOf('\\n}') + 6);"
  SCRIPT="$SCRIPT require('vm').runInThisContext(script, \"$FILE\");"
  ## eval $SCRIPT
  node -e "$SCRIPT" "$@"
}

shTravisEncrypt() {
  ## this function travis-encrypts github repo $1's secret $2
  local GITHUB_REPO=$1
  local SECRET=$2
  ## get public rsa key from https://api.travis-ci.org/repos/<owner>/<repo>/key
  curl -3fLs https://api.travis-ci.org/repos/$GITHUB_REPO/key\
    | perl -pe "s/[^-]+(.+-).+/\$1/; s/\\\\n/\n/g; s/ RSA / /g"\
    > /tmp/id_rsa.pub\
    || return $?
  ## rsa-encrypt $SECRET and print it
  printf "$SECRET"\
    | openssl rsautl -encrypt -pubin -inkey /tmp/id_rsa.pub\
    | base64\
    | tr -d "\n"\
    || return $?
}

shNpmStart() {
  ## this function runs npm start
  ## start aftership-beanstalk-client.js
  node aftership-beanstalk-client.js --mode-start || return $?
}

shNpmTest() {
  ## this function runs npm test
  export PATH=$CWD/node_modules/.bin:$PATH
  ## jshint aftership-beanstalk-client.js
  jshint aftership-beanstalk-client.js
  ## jslint aftership-beanstalk-client.js
  jslint aftership-beanstalk-client.js
  ## decrypt and exec encrypted data
  eval "$(shAesDecryptTravis)" || return $?
  ## test aftership-beanstalk-client.js
  node aftership-beanstalk-client.js --mode-test || return $?
}

shMain() {
  ## this function is the main program and parses argv
  ## return if argv is empty
  if [ "$#" = 0 ]
  then
    return
  fi
  ## save current dir to $CWD
  CWD=$(pwd)
  ## init $GITHUB_REPO
  export GITHUB_REPO=$(git config --get remote.origin.url\
    | perl -ne "print \$1 if /([^:]+)\.git$/")
  ## init $EXIT_CODE
  EXIT_CODE=0
  ## eval argv
  "$@"
  ## save $EXIT_CODE
  EXIT_CODE=$?
  ## restore $CWD
  cd $CWD
  ## return $EXIT_CODE
  return $EXIT_CODE
}
## init utility2
shMain "$@"
