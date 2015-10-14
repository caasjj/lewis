/**
 * Created by caasjj on 10/10/15.
 */
'use strict'
import Promise from 'bluebird'
import path from 'path'
import Redis from 'redis'

let redis = Redis.createClient( {
	auth_pass: 'foobared'
} )

import Lewis from '../lib/Lewis'

Promise.promisifyAll( Redis.RedisClient.prototype )
Promise.promisifyAll( Redis.Multi.prototype )

redis.on( `ready`, () => {

	let lewis = new Lewis( redis )
  let scriptName = 'hello-world'

	lewis.load( path.resolve( __dirname, `../lua` ), [scriptName + '.lua'] )
			 .then( scripts => {
				 if (scripts.length) {
					 let script = scripts[0]
					 console.log( `I loaded '${script.name}' from '${script.filePath}' and got sha1 '${script.sha1}'` )
				 } else {
					 console.log( `Nothing to download! '${scriptName}' already loaded in Redis.` )
				 }
				 console.log(`Running ${scriptName}`)
				 return lewis.run( scriptName, `Big Bob` )
			 } )
			 .then( msg => {
				 console.log( `Redis says ${msg}` )
			 } )
			 .finally( () => {
					 redis.unref()
				 } )

} )