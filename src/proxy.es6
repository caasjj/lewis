/**
 * Created by caasjj on 10/15/15.
 */
'use strict'
var net = require('net')
var sockets = []

var proxyServer = net.createServer( function( client ) {
	var proxied = net.createConnection({
		host: 'localhost',
		port: 6379
	})
	proxied.pipe( client )
	client.pipe( proxied )
	proxied.on('end', () => client.end() )
	client.on('end', () => proxied.end() )
	proxied.on('error', () => client.end() )
	client.on('error', () => proxied.end() )
	proxied.on('close', () => client.end() )
	client.on('close', () => proxied.end() )
} )

proxyServer.on('connection', socket => {
	sockets.push( socket )
})

module.exports = {
	listen: proxyServer.listen.bind(proxyServer),
	fail: function() {
		sockets.forEach( socket => {
			socket.end()
		} )
	  proxyServer.close()
	}

}