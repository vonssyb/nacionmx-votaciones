/**
 * BackupService - Automated Database Backup System
 * 
 * Exports critical data to JSON files daily for disaster recovery
 * Supports local storage and cloud upload (Google Drive/S3)
 */

const fs = require('fs').promises;
const path = require('path');

class BackupService {
    constructor(supabase) {
        this.supabase = supabase;
        this.backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');
        this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
    }

    /**
     * Ensure backup directory exists
     */
    async ensureBackupDirectory() {
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
            console.log(`[BackupService] Backup directory ready: ${this.backupDir}`);
        } catch (error) {
            console.error('[BackupService] Error creating backup directory:', error);
            throw error;
        }
    }

    /**
     * Export user balances to JSON
     */
    async exportUserBalances() {
        const { data, error } = await this.supabase
            .from('user_balances')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[BackupService] Error exporting balances:', error);
            return null;
        }

        return data;
    }

    /**
     * Export sanctions to JSON
     */
    async exportSanctions() {
        const { data, error } = await this.supabase
            .from('sanctions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[BackupService] Error exporting sanctions:', error);
            return null;
        }

        return data;
    }

    /**
     * Export licenses to JSON
     */
    async exportLicenses() {
        const { data, error } = await this.supabase
            .from('rp_licences_registry')
            .select('*')
            .order('issued_at', { ascending: false });

        if (error) {
            console.error('[BackupService] Error exporting licenses:', error);
            return null;
        }

        return data;
    }

    /**
     * Export store purchases to JSON
     */
    async exportStorePurchases() {
        const { data, error } = await this.supabase
            .from('store_purchases')
            .select('*')
            .order('purchased_at', { ascending: false });

        if (error) {
            console.error('[BackupService] Error exporting store purchases:', error);
            return null;
        }

        return data;
    }

    /**
     * Export transaction logs (last 90 days)
     */
    async exportTransactionLogs() {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const { data, error } = await this.supabase
            .from('transaction_logs')
            .select('*')
            .gte('created_at', ninetyDaysAgo.toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[BackupService] Error exporting transaction logs:', error);
            return null;
        }

        return data;
    }

    /**
     * Export credit cards
     */
    async exportCreditCards() {
        const { data, error } = await this.supabase
            .from('credit_cards')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[BackupService] Error exporting credit cards:', error);
            return null;
        }

        return data;
    }

    /**
     * Perform full backup
     */
    async performFullBackup() {
        try {
            console.log('[BackupService] Starting full backup...');
            await this.ensureBackupDirectory();

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFolder = path.join(this.backupDir, `backup_${timestamp}`);

            await fs.mkdir(backupFolder, { recursive: true });

            // Export all data
            const exports = {
                user_balances: await this.exportUserBalances(),
                sanctions: await this.exportSanctions(),
                licenses: await this.exportLicenses(),
                store_purchases: await this.exportStorePurchases(),
                transaction_logs: await this.exportTransactionLogs(),
                credit_cards: await this.exportCreditCards()
            };

            // Save each export to file
            const results = {};
            for (const [name, data] of Object.entries(exports)) {
                if (data) {
                    const filePath = path.join(backupFolder, `${name}.json`);
                    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
                    results[name] = {
                        success: true,
                        records: data.length,
                        path: filePath
                    };
                    console.log(`[BackupService] ✅ Exported ${data.length} ${name} records`);
                } else {
                    results[name] = {
                        success: false,
                        records: 0
                    };
                    console.log(`[BackupService] ❌ Failed to export ${name}`);
                }
            }

            // Create metadata file
            const metadata = {
                timestamp: new Date().toISOString(),
                version: '1.0',
                results
            };

            await fs.writeFile(
                path.join(backupFolder, 'metadata.json'),
                JSON.stringify(metadata, null, 2),
                'utf8'
            );

            console.log(`[BackupService] ✅ Full backup completed: ${backupFolder}`);

            // Cleanup old backups
            await this.cleanupOldBackups();

            return { success: true, folder: backupFolder, results };

        } catch (error) {
            console.error('[BackupService] ❌ Backup failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Clean up old backups (older than retention period)
     */
    async cleanupOldBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

            for (const file of files) {
                if (!file.startsWith('backup_')) continue;

                const filePath = path.join(this.backupDir, file);
                const stats = await fs.stat(filePath);

                if (stats.mtime < cutoffDate) {
                    await fs.rm(filePath, { recursive: true, force: true });
                    console.log(`[BackupService] 🗑️ Deleted old backup: ${file}`);
                }
            }
        } catch (error) {
            console.error('[BackupService] Error cleaning up old backups:', error);
        }
    }

    /**
     * Get backup statistics
     */
    async getBackupStats() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backups = files.filter(f => f.startsWith('backup_'));

            const stats = [];
            for (const backup of backups.slice(0, 10)) { // Last 10 backups
                const backupPath = path.join(this.backupDir, backup);
                const metadataPath = path.join(backupPath, 'metadata.json');

                try {
                    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
                    const backupStats = await fs.stat(backupPath);

                    stats.push({
                        name: backup,
                        timestamp: metadata.timestamp,
                        size: backupStats.size,
                        results: metadata.results
                    });
                } catch (e) {
                    // Skip if metadata missing
                }
            }

            return stats;
        } catch (error) {
            console.error('[BackupService] Error getting backup stats:', error);
            return [];
        }
    }
}

module.exports = BackupService;
