# LEWIS - a promise based script loader for Redis written in ES2015

1. Checks SHA1 signature and loads only files not already on the server
2. Automatically detects KEYS[x] in lua script to correctly configure #key field when invoking the script
3. Can load all `.lua` files in a directory, or a subset of them
4. scripts that throw with `assert(condition, 'ERR_xxx_yyy..')` will always be rejected with
    an 'OperationalError' representing 'ERR_xxx_yyy...'
5. Loading a running scripts can be as simple as:

   // create a loader, injecting in a 'redis' client connection
   let lewis = new Lewis( redis )

   // you have a script 'scriptName.lua' in directory 'dirPath' that takes in 2 keys and 2 arguments
   lewis.load( dirPath )
        .then( return lewis.run('scriptName', key1, key2, arg1, arg2) )


Before installation, be sure you have a redis instance runnging on port 6379 on 'localhost'. Otherwise,
configure your redis client accordingly - see `example/lewis-example.es6`


Installation

    npm install lewis
    cd lewis
    npm install

To run the example
    npm run compile
    npm run compile-example
    node lib/lewis-example

To run the tests
    npm run compile-test
    npm test

    // or

    npm run compileAndTest