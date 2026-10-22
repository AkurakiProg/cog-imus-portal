const EventEmitter = require('events');

class RealtimeBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(300);
    }

    notify(type, data = {}) {
        const payload = {
            type,
            data,
            timestamp: Date.now()
        };
        try {
            this.emit('realtime_event', payload);
        } catch (err) {
            console.error('Error emitting realtime event:', err);
        }
    }

    broadcast(type, data = {}) {
        this.notify(type, data);
    }
}

const realtimeBus = new RealtimeBus();
module.exports = realtimeBus;
