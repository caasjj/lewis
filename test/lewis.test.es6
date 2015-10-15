"use strict";
import Chai from 'chai'
import ChaiAsPromised from 'chai-as-promised'
import Redis from 'redis'
import path from 'path'
import Promise from 'bluebird'
import Lewis from '../../lib/lewis.js'
import Proxy from '../../lib/proxy.js'

function rel(p) {
	return path.resolve( __dirname, '' + p )
}

Chai.use( ChaiAsPromised )
var expect = Chai.expect
var should = Chai.should()


describe( `Lewis`, () => {

	var redis

	before( done => {

		// TODO: Configure redis client, fire up a new redis instance or something ...
		// stick to localhost redis for now
		redis = Redis.createClient( {
			auth_pass: 'foobared'
		} )

		Promise.promisifyAll( Redis.RedisClient.prototype )
		Promise.promisifyAll( Redis.Multi.prototype )

		redis.on( `ready`, () => {
			// TODO: Cofigure redis server
			redis.selectAsync( 5 )
					 .then( () => redis.flushdbAsync() )
					 .then( () => redis.scriptAsync( 'flush' ) )
					 .then( () => done() )
		} )

	} )

	after( () => {
		redis.unref()
	} )


	describe( `Instantiation`, () => {

		it( `'constructor' should throw without redis`, () => {

			function badLewis() {
				return new Lewis()
			}

			expect( badLewis ).to.throw( Promise.OperationalError )

		} )

		it( `should create successfully with redis`, () => {

			var lewis = new Lewis( redis )
			expect( lewis ).to.be.an.instanceOf( Lewis )
			expect( lewis.scripts ).to.be.empty

		} )

	} )

	describe( `Accessing script files`, () => {

		describe( `Listing script files`, () => {

			it( `'loaddir' should  reject with OperationalError on empty directory`, () => {

				return expect( Lewis.loaddir( rel( '../empty' ) ) ).to.be.rejectedWith( Promise.OperationalError )

			} )

			it( `'loaddir' should throw OperationalError on null directory`, () => {

				return expect( Lewis.loaddir( rel() ) ).to.be.rejectedWith( Promise.OperationalError )

			} )

			it( `'loaddir' should throw OperationalError on object directory`, () => {

				return expect( Lewis.loaddir( rel( {} ) ) ).to.be.rejectedWith( Promise.OperationalError )

			} )

			it( `'loaddir' should detect correct number of .lua script files when only given a directory`, () => {

				var loaded = Lewis.loaddir( rel( `../lua` ) )
				return expect( loaded ).to.eventually.have.length( 3 )

			} )

			it( `'loadfiles' should only extract lua script names when given a directory and files as an array`, () => {

				var loaded = Lewis.loadfiles( rel( `../lua` ), [`set-key.lua`, `get-key.lua`, `junk.txt`] )

				//expect( loaded ).to.eventually.be.instanceof( Array )
				return expect( loaded ).to.eventually.have.length( 2 )

			} )

		} )

		describe( `Lua Script parsing`, () => {

			it( `should extract KEY count from script`, () => {

				expect( Lewis.computeKeys( `redis.call('set', 'foo', 42)` ) ).to.equal( 0 )
				expect( Lewis.computeKeys( `redis.call('set', keys[1], 42)` ) ).to.equal( 0 )
				expect( Lewis.computeKeys( `redis.call('set', KEYS[1], 42)` ) ).to.equal( 1 )
				expect( Lewis.computeKeys( `redis.call('mget', KEYS[1], KEYS[3], KEYS[2], KEYS[8], KEYS[4])` ) ).to.equal( 8 )

			} )

		} )

	} )

	describe( `Reading script files`, () => {

		it( `'readFiles' should read list of lua script files`, () => {

			var lewis = new Lewis( redis )
			var files = [`get-key.lua`, `set-key.lua`]
			var scriptNames = files.map( file => path.basename( file, '.lua' ) ) // strip .lua from file name


			var scriptsObj = Lewis.loadfiles( rel( `../lua` ), files )
														.then( f => lewis.readFiles( f ) )
														.then( s => lewis.scripts )

			expect( scriptsObj ).to.eventually.contain.all.keys( scriptNames )

			var badPaths = scriptsObj.then( scripts => {
				return Object.keys( scripts ).some( scriptName => {
					return scripts[scriptName].filePath !== rel( '../lua' )
				} )
			} )

			expect( badPaths ).to.eventually.equal( false )
		} )

		it( `'readFiles' should throw an OperationalError if a lua script cannot be located`, () => {
			var lewis = new Lewis( redis )
			var files = [`set-key.lua`, `get-key.lua`, `non-existent.lua`]

			var scriptsObj = Lewis.loadfiles( rel( `../lua` ), files )
														.then( f => lewis.readFiles( f ) )
														.then( s => lewis.scripts )

			return expect( scriptsObj ).to.be.rejectedWith( Promise.OperationalError )
		} )

	} )


	describe( `Loading a script file to redis`, () => {

		var lewis, scriptsLoaded

		// load a script to redis before this test
		before( done => {
			lewis = new Lewis( redis )

			scriptsLoaded = Lewis.loadfiles( rel( `../lua` ), [`get-key.lua`] )
													 .then( f => lewis.readFiles( f ) )
													 .then( f => lewis.loadScripts( f ) )
													 .then( f => {done(); return f } )
		} )

		// flush the scripts after done in prep for subsequent tests
		after( done => {
			return redis.scriptAsync('flush')
					.then( () => done() )
		})

		it( `should load a file read from disk to redis`, () => {

			return expect( scriptsLoaded ).to.eventually.have.length( 1 )

		} )

		it( `the script name should match the loaded file`, () => {

			var scriptNames = scriptsLoaded.map( scriptLoaded => {
				return scriptLoaded.name
			})

			return expect( scriptNames ).to.eventually.eql( [`get-key`] )

		} )

	} )

	describe(`loading an entire directory to redis`, () => {
		var lewis, scriptsLoaded

		// load a script to redis before this test
		before( done => {
			lewis = new Lewis( redis )

			scriptsLoaded =Lewis.loaddir( rel( `../lua` ) )
													 .then( f => lewis.readFiles( f ) )
													 .then( f => lewis.loadScripts( f ) )
													 .then( f => {done(); return f } )
		} )

		// flush the scripts after done in prep for subsequent tests
		after( done => {
			return redis.scriptAsync('flush')
									.then( () => done() )
		})

		it(`should load all lua scripts in directory to redis`, () => {

			return expect( scriptsLoaded ).to.eventually.have.length( 3 )

		})

		it( `the script names should match the lua files in directory`, () => {

			var scriptNames = scriptsLoaded.map( scriptLoaded => {
				return scriptLoaded.name
			})

			return expect( scriptNames ).to.eventually.have.members( [`set-key`, `get-key`, `send-err`] )

		} )

	})


	describe(`caching scripts already loaded to redis`, () => {
		var lewis, scriptsLoaded

		// load a script to redis before this test
		before( done => {
			lewis = new Lewis( redis )

			scriptsLoaded =Lewis.loaddir( rel( `../lua`), [`get-key.lua`, `set-key.lua`]  )
													.then( f => lewis.readFiles( f ) )
													.then( f => lewis.loadScripts( f ) )
													.then( f => {done(); return f } )
		} )

		// flush the scripts after done in prep for subsequent tests
		after( done => {
			return redis.scriptAsync('flush')
									.then( () => done() )
		})

		it(`should not try to load scripts already loaded`, () => {

			var newFiles = Lewis.loadfiles( rel('../lua'), [`get-key.lua`, `set-key.lua`])
													.then( f => lewis.readFiles(f))
													.then( f => lewis.getUnloadedScripts())

			expect( newFiles ).to.eventually.have.length( 0 )

		})

		it(`should load new scripts`, () => {

			expect( Lewis.loadfiles('../lua', [`send-err.lua`])).to.eventually.have.length(1)

		})

	})

	describe(`running scripts loaded to redis`, () => {

		var lewis, scriptsLoaded

		// load a script to redis before this test
		before( done => {
			lewis = new Lewis( redis )

			scriptsLoaded =Lewis.loadfiles( rel( `../lua`), [`get-key.lua`, `set-key.lua`]  )
													.then( f => lewis.readFiles( f ) )
													.then( f => lewis.loadScripts( f ) )
													.then( f => {done(); return f } )
		} )

		// flush the scripts after done in prep for subsequent tests
		after( done => {
			return redis.scriptAsync('flush')
									.then( () => done() )
		})

		it(`should execute a previously uploaded script`, () => {

			var result = lewis.run('set-key', 'myKey', 1234)

			expect( result ).to.eventually.equal('OK')

		})

		it(`should reject wrong parameters sent to script`, () =>{

			var result = lewis.run(`set-key`, `myKey`)

			expect( result ).to.be.rejectedWith( Promise.OperationalError )


		})

		it(`should reject attempt to run non-existent script`, () => {

			var result = lewis.run('non-existent')

			expect( result ).to.be.rejectedWith( Promise.OperationalError)
		})


	})

	describe(`typed rejections`, () => {

		var lewis, scriptsLoaded

		// load a script to redis before this test
		before( done => {
			lewis = new Lewis( redis )

			scriptsLoaded =Lewis.loadfiles( rel( `../lua`), [`send-err.lua`]  )
													.then( f => lewis.readFiles( f ) )
													.then( f => lewis.loadScripts( f ) )
													.then( f => {done(); return f } )
		} )

		// flush the scripts after done in prep for subsequent tests
		after( done => {
			return redis.scriptAsync('flush')
									.then( () => done() )
		})

		it(`should reject a promise with error type indicated in the script`, () => {
			var result = lewis.run('send-err')

			expect( result ).to.be.rejectedWith( Promise.OperationalError, `ERR_CAUSE_JUST_BECAUSE`)
		})

		describe(`redis connection error`, () => {

			var lewis, scriptsLoaded

			Proxy.listen(12345)
			// load a script to redis before this test
			before( done => {

				var proxyRedis = Redis.createClient(12345)
				lewis = new Lewis( proxyRedis )

				scriptsLoaded =Lewis.loadfiles( rel( `../lua`), [`set-key.lua`]  )
														.then( f => lewis.readFiles( f ) )
														.then( f => lewis.loadScripts( f ) )
														.then( f => {done(); return f } )
			} )

			// flush the scripts after done in prep for subsequent tests
			after( done => {
				return redis.scriptAsync('flush')
										.then( () => done() )
			})

			it(`should reject with 'ERR_REDIS' if redis connection fails`, () => {

				Proxy.fail()

				expect( lewis.run('set-key', 'foo', 'bar') ).to.be.rejectedWith( Error, `ERR_REDIS`)

			})
		})

	})


} )