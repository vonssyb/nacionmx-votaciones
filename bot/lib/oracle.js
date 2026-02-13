// Oracle database client wrapper
// Este archivo proporciona una interfaz similar a Supabase para facilitar la migración

const oracledb = require('oracledb');
const path = require('path');

class OracleClient {
    constructor() {
        this.pool = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;

        try {
            // Configurar Oracle Client con wallet
            oracledb.initOracleClient({
                configDir: process.env.ORACLE_WALLET_LOCATION || path.join(__dirname, '../wallet')
            });

            // Crear connection pool
            this.pool = await oracledb.createPool({
                user: process.env.ORACLE_USER || 'ADMIN',
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONNECT_STRING || 'nacionmxdb_high',
                poolMin: 2,
                poolMax: 10,
                poolIncrement: 2,
                poolTimeout: 60
            });

            this.isInitialized = true;
            console.log('✅ Oracle connection pool initialized');
        } catch (err) {
            console.error('❌ Oracle initialization error:', err);
            throw err;
        }
    }

    // Ejecutar query simple
    async execute(sql, binds = [], options = {}) {
        let connection;
        try {
            connection = await this.pool.getConnection();
            const result = await connection.execute(sql, binds, {
                outFormat: oracledb.OUT_FORMAT_OBJECT,
                autoCommit: true,
                ...options
            });
            return result;
        } catch (err) {
            console.error('Query error:', err);
            throw err;
        } finally {
            if (connection) {
                try {
                    await connection.close();
                } catch (err) {
                    console.error('Error closing connection:', err);
                }
            }
        }
    }

    // SELECT wrapper estilo Supabase
    async from(tableName) {
        return {
            select: async (columns = '*', options = {}) => {
                const sql = `SELECT ${columns} FROM ${tableName}`;
                const result = await this.execute(sql);
                return { data: result.rows, error: null };
            },

            // SELECT con WHERE
            selectWhere: async (columns = '*', whereClause, binds) => {
                const sql = `SELECT ${columns} FROM ${tableName} WHERE ${whereClause}`;
                const result = await this.execute(sql, binds);
                return { data: result.rows, error: null };
            },

            // INSERT
            insert: async (data) => {
                const columns = Object.keys(data).join(', ');
                const placeholders = Object.keys(data).map((_, i) => `:${i + 1}`).join(', ');
                const values = Object.values(data);

                const sql = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;

                try {
                    const result = await this.execute(sql, values);
                    return { data: result, error: null };
                } catch (err) {
                    return { data: null, error: err };
                }
            },

            // UPDATE
            update: async (data, whereClause, whereBinds = []) => {
                const setClauses = Object.keys(data).map((key, i) => `${key} = :${i + 1}`).join(', ');
                const values = [...Object.values(data), ...whereBinds];

                const sql = `UPDATE ${tableName} SET ${setClauses} WHERE ${whereClause}`;

                try {
                    const result = await this.execute(sql, values);
                    return { data: result, error: null };
                } catch (err) {
                    return { data: null, error: err };
                }
            },

            // DELETE
            delete: async (whereClause, binds) => {
                const sql = `DELETE FROM ${tableName} WHERE ${whereClause}`;

                try {
                    const result = await this.execute(sql, binds);
                    return { data: result, error: null };
                } catch (err) {
                    return { data: null, error: err };
                }
            }
        };
    }

    // Cerrar pool
    async close() {
        if (this.pool) {
            await this.pool.close(10);
            console.log('Oracle connection pool closed');
        }
    }

    // Helper: convertir boolean para Oracle (0/1)
    toOracleBoolean(value) {
        return value ? 1 : 0;
    }

    // Helper: convertir boolean de Oracle a JS
    fromOracleBoolean(value) {
        return value === 1;
    }

    // Helper: convertir JSON para Oracle (CLOB)
    toOracleJSON(obj) {
        return JSON.stringify(obj);
    }

    // Helper: parsear JSON de Oracle
    fromOracleJSON(str) {
        try {
            return JSON.parse(str);
        } catch {
            return null;
        }
    }
}

// Singleton instance
const oracleClient = new OracleClient();

module.exports = oracleClient;
