'use strict'

import Promise from 'bluebird'
import path from 'path'
import {readdir, readFile} from 'fs'
import {createHash} from 'crypto'

let readdirP = Promise.promisify( readdir )
let readfileP = Promise.promisify( readFile )

let OperationalError = Promise.OperationalError

function nop() {
}

class Lewis {

	constructor(redis, logger = nop) {
		if (!redis) throw new OperationalError( `Redis connection required.` )
		this.logger = logger
		this.redis = redis
	}

	run(script) {

		var args = Array.prototype.slice
										.call( arguments, 1, Math.inf )

		script = path.basename( script, '.lua' )

		if (!this.scripts[script]) {
			return Promise.reject( new OperationalError( `script ${script} not found.` ) )
		}

		args.unshift( this.scripts[script].keys )
		args.unshift( this.scripts[script].sha1 )

		try {
			return this.redis.evalshaAsync.apply( this.redis, args )
								 .error( err => {
									 var errCode = /ERR_[A-Z,_]*\s*$/.exec( err.cause.message )
									 var error = errCode ? new OperationalError( errCode[0].replace( /\s*$/, '' ) ) : err
									 return Promise.reject( error )
								 } )
		} catch (err) {
			return Promise.reject( new Error( 'ERR_REDIS' ) )
		}

	}

	load(dir, fileArray) {

		var files = fileArray ? Lewis.loadfiles( dir, fileArray ) : Lewis.loaddir( dir )

		return files
			.then( files => {
				return this.readFiles( files )
			} )
			.then( scripts => {
				return this.getUnloadedScripts()
			} )
			.then( unloadedScripts => {
				return this.loadScripts( unloadedScripts )
			} )
	}

	static loaddir(dir) {

		if (typeof(dir) !== `string`) return Promise.reject( new OperationalError( 'Path must a string' ) )

		return readdirP( dir )
			.then( files => {
				return files.filter( Lewis.filterLua )
			} )
			.then( files => files.map( file => ({
				fileName: file,
				filePath: dir
			}) ) )
			.then( files => {
				return (files.length) ? files : Promise.reject( new OperationalError( 'No Lua scripts found' ) )
			} )
	}

	static loadfiles(dir, files) {
		files = Array.isArray( files ) ? files : [files]
		return Promise.resolve( files )
									.filter( function (file) {
										return Lewis.filterLua( file )
									} )
									.map( file => {
										return {
											filePath: dir,
											fileName: path.basename( file )
										}
									} )
									.then( files => {
										return (files.length) ? files : Promise.reject( new OperationalError( 'No Lua scripts found' ) )
									} )
	}

	static filterLua(file) {
		return path.extname( file ).toLowerCase() === `.lua`
	}

	readFiles(files) {

		return Promise.map( files, file => {

			return readfileP( path.resolve( file.filePath, file.fileName ), {
				encoding: 'utf8',
				flag: 'r'
			} )
				.then( res => {
					let scriptName = path.basename( file.fileName, '.lua' )
					this.scripts = this.scripts || {}
					this.scripts[scriptName] = {}
					this.scripts[scriptName].name = scriptName
					this.scripts[scriptName].filePath = file.filePath
					this.scripts[scriptName].code = res
					this.scripts[scriptName].sha1 = Lewis.computeSha1( res )
					this.scripts[scriptName].keys = Lewis.computeKeys( res )
					return this.scripts[scriptName]
				} )
				.error( () => {
					return Promise.reject( new OperationalError( `Could not read script ${file.fileName}` ) )
				} )
		} )

	}

	getUnloadedScripts() {

		var scriptNames = Object.keys( this.scripts )

		return Promise.map( scriptNames, scriptName => {
										return this.scripts[scriptName].sha1
									} )
									.then( shaArray => {
										return this.redis.scriptAsync( 'exists', shaArray )
															 .catch( err => Promise.reject( new Error( 'ERR_REDIS' ) ) )
									} )
									.then( existFlags => {
										return scriptNames.filter( (scriptName, index) => existFlags[index] ? false : true )
									} )
									.then( unloadedFiles => {
										return unloadedFiles.map( fileName => this.scripts[fileName] )
									} )

	}

	loadScripts(scripts) {

		return Promise.all( scripts.map( script => {

			return this.redis.scriptAsync( 'load', script.code )
								 .then( sha1 => {
									 if (sha1 !== script.sha1) {
										 return Promise.reject(
											 new OperationalError( `loaded sha1 ${sha1} mismatch with script ${script.name} sha1 of ${script.sha1}` )
										 )
									 }
									 return script
								 } )
								 .catch( err => Promise.reject( new Error( 'ERR_REDIS' ) ) )

		} ) )
	}

	static computeSha1(luaScript) {
		return createHash( 'sha1' )
			.update( luaScript )
			.digest( 'hex' )
	}

	static computeKeys(luaScript) {

		var keys = luaScript.match( /KEYS\[[1-9][0-9]*\]/g )

		if (!Array.isArray( keys )) return 0

		return keys.reduce( (prev, key) => {
			var newMax = +key.split( "[" )[1].replace( "]", "" )

			return newMax>prev ? newMax : prev
		}, 0 )
	}

}

export {Lewis as default}