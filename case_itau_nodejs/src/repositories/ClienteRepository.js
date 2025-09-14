const Cliente = require('../models/Cliente');

class ClienteRepository {
    constructor(db) {
        this.db = db;
    }

    async findAll() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM clientes', [], (err, rows) => {
                if (err) return reject(err);
                const clientes = rows.map(row => new Cliente(row.id, row.nome, row.email, row.saldo));
                resolve(clientes);
            });
        });
    }

    async findById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM clientes WHERE id = ?', [id], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);
                resolve(new Cliente(row.id, row.nome, row.email, row.saldo));
            });
        });
    }

    async create(cliente) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO clientes (nome, email, saldo) VALUES (?, ?, ?)',
                [cliente.nome, cliente.email, cliente.saldo],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                }
            );
        });
    }

    async update(id, cliente) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE clientes SET nome = ?, email = ? WHERE id = ?',
                [cliente.nome, cliente.email, id],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    async delete(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM clientes WHERE id = ?', [id], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    async updateSaldo(id, novoSaldo) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE clientes SET saldo = ? WHERE id = ?',
                [novoSaldo, id],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }
}

module.exports = ClienteRepository;