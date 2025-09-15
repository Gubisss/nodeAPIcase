const Cliente = require('../models/Cliente');
const semaphore = require('../utils/Semaphore');

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

    async atualizarSaldoComTransacao(id, operacao, valor) {
        let transactionActive = false;

        const runQuery = (query, params) => {
            return new Promise((resolve, reject) => {
                this.db.run(query, params, function(err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            });
        };

        const getQuery = (query, params) => {
            return new Promise((resolve, reject) => {
                this.db.get(query, params, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        };

        const safeRollback = async () => {
            if (transactionActive) {
                try {
                    await runQuery('ROLLBACK', []);
                    transactionActive = false;
                } catch (rollbackError) {
                    console.error('Aviso: Erro no rollback (pode ser ignorado se a transação já foi finalizada)');
                }
            }
        };

        // Adquire o lock do semáforo para este cliente
        await semaphore.acquire(id);

        // A partir daqui, temos exclusividade garantida para este ID de cliente
        try {
            try {
                // Inicia a transação com bloqueio exclusivo
                await runQuery('BEGIN IMMEDIATE TRANSACTION', []);
                transactionActive = true;

                // Busca o saldo atual
                const row = await getQuery('SELECT * FROM clientes WHERE id = ?', [id]);
                
                if (!row) {
                    await safeRollback();
                    throw new Error('Cliente não encontrado');
                }

                let novoSaldo;
                if (operacao === 'sacar') {
                    if (row.saldo < valor) {
                        await safeRollback();
                        throw new Error('Saldo insuficiente');
                    }
                    novoSaldo = row.saldo - valor;
                } else if (operacao === 'depositar') {
                    novoSaldo = row.saldo + valor;
                }

                // Atualiza o saldo usando uma condição que garante que o saldo não mudou
                const updateResult = await runQuery(
                    'UPDATE clientes SET saldo = ? WHERE id = ? AND saldo = ?',
                    [novoSaldo, id, row.saldo]
                );

                if (updateResult.changes === 0) {
                    await safeRollback();
                    throw new Error('Conflito de concorrência detectado');
                }

                // Confirma a transação
                await runQuery('COMMIT', []);
                transactionActive = false;
                
                return novoSaldo;
            } catch (error) {
                await safeRollback();
                throw error;
            } finally {
                // Libera o lock do semáforo
                semaphore.release(id);
            }
        } catch (error) {
            // Se houver erro antes mesmo de começar a transação
            semaphore.release(id);
            throw error;
        }
    }
}

module.exports = ClienteRepository;