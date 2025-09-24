/**
 * Import data from JSON exports into Cloudflare D1
 * Run with: npx tsx import-to-d1.ts
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ExportMetadata {
  export_date: string;
  source_database: string;
  tables: string[];
}

interface ImportOptions {
  environment: 'development' | 'staging' | 'production';
  batchSize: number;
  skipTables?: string[];
}

class D1Importer {
  private exportDir: string;
  private options: ImportOptions;

  constructor(exportDir: string, options: Partial<ImportOptions> = {}) {
    this.exportDir = exportDir;
    this.options = {
      environment: 'development',
      batchSize: 100,
      ...options,
    };
  }

  async import(): Promise<void> {
    console.log('Starting D1 import process...');

    // Load metadata
    const metadata = await this.loadMetadata();
    console.log(`Import from export date: ${metadata.export_date}`);

    // Import each table
    for (const table of metadata.tables) {
      if (this.options.skipTables?.includes(table)) {
        console.log(`Skipping table: ${table}`);
        continue;
      }

      await this.importTable(table);
    }

    console.log('Import completed successfully!');
  }

  private async loadMetadata(): Promise<ExportMetadata> {
    const metadataPath = path.join(this.exportDir, 'metadata.json');
    const content = await fs.promises.readFile(metadataPath, 'utf-8');
    return JSON.parse(content);
  }

  private async importTable(tableName: string): Promise<void> {
    console.log(`\nImporting table: ${tableName}`);

    const dataPath = path.join(this.exportDir, `${tableName}.json`);
    const data = JSON.parse(await fs.promises.readFile(dataPath, 'utf-8'));

    if (!Array.isArray(data) || data.length === 0) {
      console.log(`  No data to import for ${tableName}`);
      return;
    }

    console.log(`  Found ${data.length} records`);

    // Process in batches
    const batches = this.createBatches(data, this.options.batchSize);

    for (let i = 0; i < batches.length; i++) {
      await this.importBatch(tableName, batches[i], i + 1, batches.length);
    }

    console.log(`  ✓ Imported ${data.length} records to ${tableName}`);
  }

  private createBatches<T>(data: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    return batches;
  }

  private async importBatch(
    tableName: string,
    batch: any[],
    batchNum: number,
    totalBatches: number
  ): Promise<void> {
    console.log(`  Processing batch ${batchNum}/${totalBatches}...`);

    // Generate SQL for batch insert
    const sql = this.generateBatchInsertSQL(tableName, batch);

    // Execute SQL using wrangler d1 execute
    const tempFile = path.join(this.exportDir, 'temp.sql');
    await fs.promises.writeFile(tempFile, sql);

    try {
      const dbName = this.getD1DatabaseName();
      const command = `npx wrangler d1 execute ${dbName} --file="${tempFile}" --env=${this.options.environment}`;

      await execAsync(command, {
        cwd: path.join(__dirname, '..', 'workers', 'gateway'),
      });
    } catch (error) {
      console.error(`  Error importing batch ${batchNum}:`, error);
      throw error;
    } finally {
      // Clean up temp file
      await fs.promises.unlink(tempFile).catch(() => {});
    }
  }

  private generateBatchInsertSQL(tableName: string, records: any[]): string {
    if (records.length === 0) return '';

    // Get column names from first record
    const columns = Object.keys(records[0]);
    const columnList = columns.join(', ');

    // Generate VALUES clauses
    const values = records.map(record => {
      const valueList = columns.map(col => {
        const value = record[col];
        if (value === null || value === undefined) {
          return 'NULL';
        } else if (typeof value === 'string') {
          return `'${value.replace(/'/g, "''")}'`;
        } else if (typeof value === 'boolean') {
          return value ? '1' : '0';
        } else {
          return value;
        }
      }).join(', ');
      return `(${valueList})`;
    });

    // Special handling for certain tables
    let insertType = 'INSERT OR REPLACE';
    if (tableName === 'users' || tableName === 'api_keys') {
      insertType = 'INSERT OR IGNORE'; // Preserve existing users
    }

    return `${insertType} INTO ${tableName} (${columnList}) VALUES\n${values.join(',\n')};`;
  }

  private getD1DatabaseName(): string {
    switch (this.options.environment) {
      case 'production':
        return 'researchtoolspy-prod';
      case 'staging':
        return 'researchtoolspy-staging';
      default:
        return 'researchtoolspy-dev';
    }
  }

  async verify(): Promise<void> {
    console.log('\nVerifying imported data...');

    const metadata = await this.loadMetadata();
    const dbName = this.getD1DatabaseName();

    for (const table of metadata.tables) {
      if (this.options.skipTables?.includes(table)) {
        continue;
      }

      try {
        const command = `npx wrangler d1 execute ${dbName} --command="SELECT COUNT(*) as count FROM ${table}" --env=${this.options.environment}`;
        const { stdout } = await execAsync(command, {
          cwd: path.join(__dirname, '..', 'workers', 'gateway'),
        });

        // Parse count from output
        const match = stdout.match(/"count":\s*(\d+)/);
        const count = match ? parseInt(match[1]) : 0;

        console.log(`  ${table}: ${count} records`);
      } catch (error) {
        console.error(`  Error verifying ${table}:`, error);
      }
    }
  }
}

// Main execution
async function main() {
  const exportDir = path.join(__dirname, 'exports');

  // Check if export directory exists
  if (!fs.existsSync(exportDir)) {
    console.error('Export directory not found. Please run export-existing-data.sh first.');
    process.exit(1);
  }

  const importer = new D1Importer(exportDir, {
    environment: process.env.D1_ENV as any || 'development',
    batchSize: parseInt(process.env.BATCH_SIZE || '100'),
    skipTables: process.env.SKIP_TABLES?.split(','),
  });

  try {
    // Run import
    await importer.import();

    // Verify import
    await importer.verify();

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}