# LEWIS
a promise based script loader for Redis written in ES2015

1. Checks SHA1 signature and loads only files not already on the server
2. Automatically detects **KEYS[x]** in lua script to correctly configure **#key** field when invoking the script
3. Can load all `.lua` files in a directory, or a subset of them
4. scripts that throw with `assert(condition, 'ERR_xxx_yyy..')` will always be rejected with
    an `OperationalError` representing error `ERR_xxx_yyy...`


Loading and running scripts is as simple as: 
 
         // import the module 
         let Lewis =  require('Lewis') 

	// or better yet, use 'import' if transpiling, using jspm, etc.
        import Lewis form 'lewis'
 
	 // create a loader, injecting in a redis client
 	 let lewis = Lewis( redis ) 

	// you have a script 'scriptName.lua' in directory 'dirPath' that takes in 2 keys and 2 arguments
    lewis.load( dirPath )
        .then( return lewis.run('scriptName', key1, key2, arg1, arg2) )

    // or to download only a specific set of scripts', just provide the files in an array
    lewis.load( dirPath, ['script1.lua', 'script2.lua'] )
        .then( return lewis.run('script1', key, arg) )

# Installation

    npm install lewis
    cd lewis
    npm install

# Examples and Tests

Before trying to run the example or test, be sure you have a redis instance runnging on port 6379 on 'localhost'. Otherwise,

configure your redis client accordingly - see `example/lewis-example.es6`


To run the example
    npm run compile
    npm run compile-example
    node lib/lewis-example

###### Warning: the test script will `flush` all scripts on the server. Be sure to use a test server!
To run the tests

    npm run compile-test
    npm test
    // or
    npm run compile-and-test
    
    
    
    
