import fs = require('fs');
import cp = require('child_process');
import http = require('http');

import { connection, tryConnect as tryConnect } from './Showdown/PSConnection';

import { shoestart } from './Shoedrip/shoedrip';

import { router } from './Website/routes';

import * as mongo from './Backend/mongo';
import { settings } from './Backend/settings';
import { Cringer } from './Backend/CringeProvider';
import { IPCServer } from './Website/DogarsIPCServer';
import { dogarsroutine } from './dogars-chan';

setInterval(async () => {
    let backup = `${settings.ressources}/public/backup.tar.gz`;
    cp.spawnSync('mongodump', ['--db', settings.db.database, '--gzip', '-o', `${settings.ressources}/public`]);
    cp.spawnSync('tar', ['-czf', backup, `${settings.ressources}/public/${settings.db.database}`]);
}, 3600 * 1000);

console.log('Starting web server...');

let server = http.createServer(router);
Cringer.install(server);
IPCServer.install(server);

server.listen(+process.argv[2] || 1234, '0.0.0.0', async () => {
    console.log('Web server started, initializing database connection...');
    await mongo.init();
    console.log('Database connection started, initializing showdown connection...');
    await tryConnect();
    console.log('Showdown connection started, initializing showderp watch service...');
    shoestart();
    dogarsroutine();
});
