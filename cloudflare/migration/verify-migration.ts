/**
 * Verify data migration integrity between source and D1 databases
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface VerificationReport {
  table: string;
  sourceCount: number;
  targetCount: number;
  match: boolean;
  samples?: any[];
}

class MigrationVerifier {
  private exportDir: string;
  private environment: string;

  constructor(exportDir: string, environment = 'development') {
    this.exportDir = exportDir;
    this.environment = environment;
  }

  async verify(): Promise<void> {
    console.log('Starting migration verification...\n');

    const reports: VerificationReport[] = [];
    const metadata = JSON.parse(
      await fs.promises.readFile(
        path.join(this.exportDir, 'metadata.json'),
        'utf-8'
      )
    );

    for (const table of metadata.tables) {
      const report = await this.verifyTable(table);
      reports.push(report);
    }

    this.printReport(reports);
  }

  private async verifyTable(tableName: string): Promise<VerificationReport> {
    console.log(`Verifying ${tableName}...`);

    // Get source count
    const sourceData = JSON.parse(
      await fs.promises.readFile(
        path.join(this.exportDir, `${tableName}.json`),
        'utf-8'
      )
    );
    const sourceCount = Array.isArray(sourceData) ? sourceData.length : 0;

    // Get target count from D1
    const targetCount = await this.getD1TableCount(tableName);

    // Sample verification (check first few records)
    const samples = await this.sampleVerification(tableName, sourceData.slice(0, 3));

    return {
      table: tableName,
      sourceCount,
      targetCount,
      match: sourceCount === targetCount,
      samples,
    };
  }

  private async getD1TableCount(tableName: string): Promise<number> {
    try {
      const dbName = this.getD1DatabaseName();
      const command = `npx wrangler d1 execute ${dbName} --command="SELECT COUNT(*) as count FROM ${tableName}" --env=${this.environment} --json`;

      const { stdout } = await execAsync(command, {
        cwd: path.join(__dirname, '..', 'workers', 'gateway'),
      });

      const result = JSON.parse(stdout);
      return result[0]?.results?.[0]?.count || 0;
    } catch (error) {
      console.error(`Error getting count for ${tableName}:`, error);
      return -1;
    }
  }

  private async sampleVerification(
    tableName: string,
    sourceRecords: any[]
  ): Promise<any[]> {
    if (sourceRecords.length === 0) return [];

    const samples = [];
    for (const record of sourceRecords) {
      try {
        const verified = await this.verifyRecord(tableName, record);
        samples.push(verified);
      } catch (error) {
        samples.push({ error: error.message });
      }
    }

    return samples;
  }

  private async verifyRecord(tableName: string, record: any): Promise<any> {
    // Get primary key field (assume 'id' for most tables)
    const idField = this.getPrimaryKeyField(tableName);
    const id = record[idField];

    if (!id) {
      return { status: 'no_id' };
    }

    try {
      const dbName = this.getD1DatabaseName();
      const command = `npx wrangler d1 execute ${dbName} --command="SELECT * FROM ${tableName} WHERE ${idField} = '${id}'" --env=${this.environment} --json`;

      const { stdout } = await execAsync(command, {
        cwd: path.join(__dirname, '..', 'workers', 'gateway'),
      });

      const result = JSON.parse(stdout);
      const targetRecord = result[0]?.results?.[0];

      if (!targetRecord) {
        return { id, status: 'not_found' };
      }

      // Compare key fields
      const differences = this.compareRecords(record, targetRecord);
      return {
        id,
        status: differences.length === 0 ? 'match' : 'mismatch',
        differences,
      };
    } catch (error) {
      return { id, status: 'error', error: error.message };
    }
  }

  private compareRecords(source: any, target: any): string[] {
    const differences: string[] = [];
    const skipFields = ['created_at', 'updated_at']; // Skip timestamp fields

    for (const key in source) {
      if (skipFields.includes(key)) continue;

      const sourceValue = source[key];
      const targetValue = target[key];

      if (sourceValue !== targetValue) {
        // Handle special cases
        if (
          (sourceValue === null && targetValue === undefined) ||
          (sourceValue === undefined && targetValue === null)
        ) {
          continue;
        }

        if (typeof sourceValue === 'boolean' && typeof targetValue === 'number') {
          // SQLite stores booleans as 0/1
          if ((sourceValue && targetValue === 1) || (!sourceValue && targetValue === 0)) {
            continue;
          }
        }

        differences.push(`${key}: ${sourceValue} → ${targetValue}`);
      }
    }

    return differences;
  }

  private getPrimaryKeyField(tableName: string): string {
    const customKeys: Record<string, string> = {
      users: 'id',
      framework_sessions: 'id',
      processed_urls: 'id',
      citations: 'id',
      research_jobs: 'id',
    };

    return customKeys[tableName] || 'id';
  }

  private getD1DatabaseName(): string {
    switch (this.environment) {
      case 'production':
        return 'researchtoolspy-prod';
      case 'staging':
        return 'researchtoolspy-staging';
      default:
        return 'researchtoolspy-dev';
    }
  }

  private printReport(reports: VerificationReport[]): void {
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION VERIFICATION REPORT');
    console.log('='.repeat(60) + '\n');

    const tableWidth = 25;
    const countWidth = 12;

    console.log(
      'Table'.padEnd(tableWidth) +
      'Source'.padEnd(countWidth) +
      'Target'.padEnd(countWidth) +
      'Status'
    );
    console.log('-'.repeat(60));

    let allMatch = true;

    for (const report of reports) {
      const status = report.match ? '✅ Match' : '❌ Mismatch';
      allMatch = allMatch && report.match;

      console.log(
        report.table.padEnd(tableWidth) +
        report.sourceCount.toString().padEnd(countWidth) +
        report.targetCount.toString().padEnd(countWidth) +
        status
      );

      // Print sample verification details if there are issues
      if (report.samples?.some(s => s.status !== 'match')) {
        for (const sample of report.samples) {
          if (sample.status !== 'match') {
            console.log(`  Sample ${sample.id}: ${sample.status}`);
            if (sample.differences) {
              for (const diff of sample.differences) {
                console.log(`    - ${diff}`);
              }
            }
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    if (allMatch) {
      console.log('✅ All tables verified successfully!');
    } else {
      console.log('⚠️ Some tables have mismatches. Please review.');
    }
    console.log('='.repeat(60) + '\n');
  }
}

// Main execution
async function main() {
  const exportDir = path.join(__dirname, 'exports');
  const environment = process.env.D1_ENV || 'development';

  if (!fs.existsSync(exportDir)) {
    console.error('Export directory not found. Please run export-existing-data.sh first.');
    process.exit(1);
  }

  const verifier = new MigrationVerifier(exportDir, environment);

  try {
    await verifier.verify();
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}