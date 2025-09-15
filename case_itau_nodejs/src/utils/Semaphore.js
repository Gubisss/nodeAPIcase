class Semaphore {
    constructor() {
        this.locks = new Map();
        this.queues = new Map();
    }

    async acquire(clientId) {
        if (!this.locks.has(clientId)) {
            this.locks.set(clientId, false);
            this.queues.set(clientId, []);
        }

        if (this.locks.get(clientId)) {
            // Se o lock está ativo, adiciona uma nova promessa na fila
            return new Promise(resolve => {
                this.queues.get(clientId).push(resolve);
            });
        }

        // Se não está bloqueado, adquire o lock imediatamente
        this.locks.set(clientId, true);
    }

    release(clientId) {
        const queue = this.queues.get(clientId);
        if (queue && queue.length > 0) {
            // Se há alguém esperando, libera o próximo
            const next = queue.shift();
            next();
        } else {
            // Se não há ninguém esperando, libera o lock
            this.locks.set(clientId, false);
        }

        // Limpa a fila se estiver vazia
        if (queue && queue.length === 0) {
            this.queues.delete(clientId);
            this.locks.delete(clientId);
        }
    }
}

module.exports = new Semaphore();