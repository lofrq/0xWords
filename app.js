/**
 * ==== ENVIRONMENT VARIABLES ====
 * Default enviroment: development
 * If you need start application in another environment:
 *
 * Run in production mode:
 * NODE_ENV=production node master.js
 *
 * Debug cluster:
 * NODE_DEBUG=cluster node master.js
 *
 * Set workers number:
 * NUM_WORKERS=4 node master.js
 *
 *
 * ==== DEFAULT SIGNALS ====
 * Stop master and gracefully shutdown all workers
 * pgrep -f 'node master.js' | xargs kill -SIGINT
 * or
 * pgrep -f 'node master.js' | xargs kill -SIGTERM
 *
 *
 * Add new worker
 * pgrep -f 'node master.js' | xargs kill -SIGTTIN
 *
 *
 * Remove worker
 * pgrep -f 'node master.js' | xargs kill -SIGTTOU
 *
 *
 * Reload workers one by one
 * pgrep -f 'node master.js' | xargs kill -SIGHUP
 * or
 * pgrep -f 'node master.js' | xargs kill -SIGUSR2
 *
 *
 * Reset number of workers to initial value
 * pgrep -f 'node master.js' | xargs kill -SIGWINCH
 */

var
    /** Node packages */
    cluster         = require('cluster'),
    colors          = require('colors'),
    os              = require('os'),
    path            = require('path'),

    /** Config */
    env             = process.env.NODE_ENV || 'development',
    numWorkers      = process.env.NUM_WORKERS || os.cpus().length,
    workerMaxMemory = process.env.WORKER_MAX_MEMORY || '150M',
    packageJSON     = require('./package'),

    i,

    SIGNALS_CONFIG = {
        /** Graceful shutdown workers */
        'SHUTDOWN_WORKERS': ['SIGINT', 'SIGTERM'],

        /** Add one worker */
        'ADD_WORKER': ['SIGTTIN'],

        /** Graceful shutdown one worker */
        'REMOVE_WORKER': ['SIGTTOU'],

        /** Graceful reload of workers one by one */
        'RELOAD_ONE_BY_ONE': ['SIGHUP', 'SIGUSR2'],

        /** Reset number of workers to initial value */
        'RESET_WORKERS_NUMBER': ['SIGWINCH']
    },


    /**
     * Graceful shutdown all workers and start new workers
     *
     * @param   {String}    signal                  POSIX signal name
     * @param   {Number}    expectedWorkersCount    Number of workers which should be started
     */
    shutDownAllAndStartNew = function( expectedWorkersCount ) {
        var
            waitDeath = function() {
                if ( Object.keys(cluster.workers).length ) {
                    setTimeout(waitDeath, 1000);
                } else if ( !expectedWorkersCount ) {
                    process.exit();
                } else {
                    numWorkers = expectedWorkersCount;
                    alignWorkers();
                }
            };

        console.log('Shutting down all workers');
        waitDeath();
        alignWorkers(0);
    },

    /**
     * Reload all workers one by one
     *
     * @param   {Array}     [reloadIDs]   Workers IDs, which should be reloaded
     */
    reloadOneByOne = function( reloadIDs ) {
        var
            id,

            waitNewWorker = function() {
                var
                    workersArr   = Object.keys(cluster.workers),
                    lastWorkerId = workersArr[workersArr.length - 1];

                if ( numWorkers === workersArr.length && cluster.workers[lastWorkerId].status === 'LISTENING' ) {
                    reloadOneByOne(reloadIDs);
                } else {
                    setTimeout(waitNewWorker, 1000);
                }
            },

            waitDeath = function( id ) {
                if ( cluster.workers[id] ) {
                    setTimeout(waitDeath.bind(this, id), 1000);
                } else {
                    waitNewWorker();
                }
            };

        if ( typeof reloadIDs === 'undefined' ) {
            reloadIDs = [];
            for ( id in cluster.workers ) {
                reloadIDs.push(id);
            }
        }

        if ( !reloadIDs.length ) {
            console.log('Reload workers complete'.green);
            return;
        }

        id = reloadIDs.pop();

        console.log('Worker %s: reloading...'.yellow, id);

        cluster.workers[id].disconnect();
        waitDeath(id);
    },

    /**
     * Worker 'listening' handler
     *
     * @param   {Object}    worker
     * @param   {Object}    address
     */
    workerOnlineHandler = function( worker, address ) {
        console.log('Worker %s: Enviroment: %s. Listening http://%s:%s. PID %s'.green, worker.id, env, address.address, address.port, worker.process.pid);
        worker.status = 'LISTENING';
    },

    /**
     * Worker 'exit' handler
     *
     * @param   {Object}    worker
     * @param   {String}    code    Exit code
     * @param   {String}    signal  POSIX signal name
     */
    workerExitHandler = function( worker, code, signal ) {
        if ( signal ) {
            console.log('Worker %s: killed by signal: %s'.red, worker.id, signal);
        } else {
            console.log('Worker %s: exited with error code: %s'.red, worker.id, code);
        }

        alignWorkers();
    },

    /**
     * Align to the expected number of workers.
     * If actual number of workers more than expected, have to delete extra workers
     * If actual number of workers less than expected, have to add workers
     *
     * @param   {Number}  [num]   Expected number of workers
     */
    alignWorkers = function( num ) {
        var
            actualWorkersNumber   = Object.keys(cluster.workers).length || 0,
            expectedWorkersNumber = ( typeof num === 'number' ) ? num : numWorkers,
            count, i;

        numWorkers = expectedWorkersNumber;

        if ( expectedWorkersNumber > actualWorkersNumber ) {
            count = expectedWorkersNumber - actualWorkersNumber;

            for ( i = 0; i < count; i++ ) {
                // to prevent CPU-splsions if crashing too fast
                setTimeout(cluster.fork, 1000);
            }
        } else if ( expectedWorkersNumber < actualWorkersNumber ) {
            count = actualWorkersNumber - expectedWorkersNumber;

            for ( i in cluster.workers ) {
                if ( !--count ) {
                    cluster.workers[i].disconnect();
                }
            }
        }
    },

    /**
     * Incrementing the number of workers
     */
    incWorkers = function() {
        numWorkers++;
        alignWorkers();
    },

    /**
     * Reducing the number of workers
     */
    removeWorker = function() {
        numWorkers--;
        alignWorkers();
    };


// Set process title
// process.title = packageJSON.name;

// Set signals
for ( i = 0; i < SIGNALS_CONFIG.SHUTDOWN_WORKERS.length; i++ ) {
    process.on(SIGNALS_CONFIG.SHUTDOWN_WORKERS[i], shutDownAllAndStartNew.bind(this, 0));
}

for ( i = 0; i < SIGNALS_CONFIG.ADD_WORKER.length; i++ ) {
    process.on(SIGNALS_CONFIG.ADD_WORKER[i], incWorkers);
}

for ( i = 0; i < SIGNALS_CONFIG.REMOVE_WORKER.length; i++ ) {
    process.on(SIGNALS_CONFIG.REMOVE_WORKER[i], removeWorker);
}

for ( i = 0; i < SIGNALS_CONFIG.RELOAD_ONE_BY_ONE.length; i++ ) {
    process.on(SIGNALS_CONFIG.RELOAD_ONE_BY_ONE[i], reloadOneByOne);
}

for ( i = 0; i < SIGNALS_CONFIG.RESET_WORKERS_NUMBER.length; i++ ) {
    process.on(SIGNALS_CONFIG.RESET_WORKERS_NUMBER[i], alignWorkers.bind(this, numWorkers));
}


// Configure cluster
cluster.setupMaster({
    exec: path.join(__dirname, 'worker.js')
});

cluster.on('exit', workerExitHandler);
cluster.on('listening', workerOnlineHandler);

// Fork workers as needed.
alignWorkers();