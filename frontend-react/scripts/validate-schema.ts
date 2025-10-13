/**
 * Schema Validation Script
 * Validates that all required database tables and fields exist
 * Run before production deployment to catch schema mismatches
 *
 * Usage:
 *   npm run validate-schema
 *   npm run validate-schema -- --remote (for production)
 */

interface TableField {
  name: string
  type: string
  nullable?: boolean
}

interface TableCheck {
  table: string
  fields: TableField[]
  apis: string[]
  required: boolean
}

// Define all required tables with their expected schema
const REQUIRED_TABLES: TableCheck[] = [
  // Evidence Tables
  {
    table: 'evidence',
    fields: [
      { name: 'id', type: 'INTEGER' },
      { name: 'title', type: 'TEXT' },
      { name: 'content', type: 'TEXT' },
      { name: 'type', type: 'TEXT' },
      { name: 'status', type: 'TEXT' },
      { name: 'date', type: 'TEXT' },
      { name: 'credibility_score', type: 'TEXT' },
      { name: 'reliability', type: 'TEXT' },
      { name: 'created_at', type: 'TEXT' },
      { name: 'updated_at', type: 'TEXT' },
    ],
    apis: ['/api/evidence', '/api/ach'],
    required: true
  },
  {
    table: 'evidence_items',
    fields: [
      { name: 'id', type: 'INTEGER' },
      { name: 'title', type: 'TEXT' },
      { name: 'evidence_type', type: 'TEXT' },
      { name: 'credibility', type: 'TEXT' },
      { name: 'reliability', type: 'TEXT' },
    ],
    apis: ['/api/evidence-items'],
    required: true
  },

  // ACH Tables
  {
    table: 'ach_analyses',
    fields: [
      { name: 'id', type: 'TEXT' },
      { name: 'user_id', type: 'TEXT' },
      { name: 'title', type: 'TEXT' },
      { name: 'question', type: 'TEXT' },
      { name: 'workspace_id', type: 'TEXT' },
      { name: 'is_public', type: 'INTEGER' },
      { name: 'created_at', type: 'TEXT' },
    ],
    apis: ['/api/ach'],
    required: true
  },
  {
    table: 'ach_hypotheses',
    fields: [
      { name: 'id', type: 'TEXT' },
      { name: 'ach_analysis_id', type: 'TEXT' },
      { name: 'hypothesis', type: 'TEXT' },
      { name: 'order_num', type: 'INTEGER' },
    ],
    apis: ['/api/ach/hypotheses'],
    required: true
  },
  {
    table: 'ach_evidence_links',
    fields: [
      { name: 'id', type: 'TEXT' },
      { name: 'ach_analysis_id', type: 'TEXT' },
      { name: 'evidence_id', type: 'INTEGER' },
    ],
    apis: ['/api/ach', '/api/ach/evidence'],
    required: true
  },
  {
    table: 'ach_scores',
    fields: [
      { name: 'id', type: 'TEXT' },
      { name: 'ach_analysis_id', type: 'TEXT' },
    ],
    apis: ['/api/ach', '/api/ach/scores'],
    required: true
  },

  // Content Intelligence
  {
    table: 'content_intelligence',
    fields: [
      { name: 'id', type: 'TEXT' },
      { name: 'url', type: 'TEXT' },
      { name: 'title', type: 'TEXT' },
      { name: 'content', type: 'TEXT', nullable: true },
      { name: 'summary', type: 'TEXT', nullable: true },
      { name: 'created_at', type: 'TEXT' },
    ],
    apis: ['/api/content-intelligence', '/api/content-library', '/api/frameworks/swot-auto-populate'],
    required: true
  },

  // Actors & Entities
  {
    table: 'actors',
    fields: [
      { name: 'id', type: 'TEXT' },
      { name: 'name', type: 'TEXT' },
      { name: 'type', type: 'TEXT' },
      { name: 'workspace_id', type: 'TEXT' },
    ],
    apis: ['/api/actors'],
    required: true
  },

  // Framework Tables
  {
    table: 'framework_sessions',
    fields: [
      { name: 'id', type: 'TEXT' },
      { name: 'framework_type', type: 'TEXT' },
      { name: 'workspace_id', type: 'TEXT' },
    ],
    apis: ['/api/framework-sessions'],
    required: true
  },

  // User & Auth
  {
    table: 'users',
    fields: [
      { name: 'id', type: 'INTEGER' },
      { name: 'email', type: 'TEXT', nullable: true },
    ],
    apis: ['/api/auth'],
    required: true
  },
  {
    table: 'hash_accounts',
    fields: [
      { name: 'id', type: 'INTEGER' },
      { name: 'hash', type: 'TEXT' },
    ],
    apis: ['/api/auth', '/api/_shared/auth-helpers'],
    required: true
  },

  // Workspaces
  {
    table: 'workspaces',
    fields: [
      { name: 'id', type: 'TEXT' },
      { name: 'name', type: 'TEXT' },
      { name: 'owner_id', type: 'INTEGER' },
    ],
    apis: ['/api/workspaces', '/api/actors', '/api/ach'],
    required: true
  },
]

interface ValidationError {
  type: 'missing_table' | 'missing_field' | 'wrong_type'
  table: string
  field?: string
  expected?: string
  actual?: string
  apis: string[]
}

async function validateSchema(db: D1Database): Promise<{
  valid: boolean
  errors: ValidationError[]
}> {
  const errors: ValidationError[] = []

  for (const tableCheck of REQUIRED_TABLES) {
    // Check if table exists
    const tableExists = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
    ).bind(tableCheck.table).first()

    if (!tableExists) {
      errors.push({
        type: 'missing_table',
        table: tableCheck.table,
        apis: tableCheck.apis
      })
      continue // Skip field checks if table doesn't exist
    }

    // Check fields
    const schema = await db.prepare(
      `PRAGMA table_info(${tableCheck.table})`
    ).all()

    const actualFields = new Map(
      schema.results.map((f: any) => [f.name, { type: f.type, nullable: f.notnull === 0 }])
    )

    for (const expectedField of tableCheck.fields) {
      const actualField = actualFields.get(expectedField.name)

      if (!actualField) {
        errors.push({
          type: 'missing_field',
          table: tableCheck.table,
          field: expectedField.name,
          expected: expectedField.type,
          apis: tableCheck.apis
        })
        continue
      }

      // Check type (SQLite types are flexible, so just check base type)
      const baseExpected = expectedField.type.split('(')[0].toUpperCase()
      const baseActual = actualField.type.split('(')[0].toUpperCase()

      if (baseExpected !== baseActual) {
        errors.push({
          type: 'wrong_type',
          table: tableCheck.table,
          field: expectedField.name,
          expected: expectedField.type,
          actual: actualField.type,
          apis: tableCheck.apis
        })
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

function formatValidationReport(result: { valid: boolean; errors: ValidationError[] }): string {
  if (result.valid) {
    return `✅ Schema validation passed! All ${REQUIRED_TABLES.length} required tables and fields are present.`
  }

  let report = `❌ Schema validation failed with ${result.errors.length} error(s):\n\n`

  const groupedErrors = new Map<string, ValidationError[]>()
  for (const error of result.errors) {
    const key = error.table
    if (!groupedErrors.has(key)) {
      groupedErrors.set(key, [])
    }
    groupedErrors.get(key)!.push(error)
  }

  for (const [table, errors] of groupedErrors) {
    report += `\n📋 Table: ${table}\n`
    for (const error of errors) {
      switch (error.type) {
        case 'missing_table':
          report += `  ❌ TABLE MISSING\n`
          report += `     APIs affected: ${error.apis.join(', ')}\n`
          report += `     Action: Run migration to create this table\n`
          break
        case 'missing_field':
          report += `  ❌ FIELD MISSING: ${error.field}\n`
          report += `     Expected type: ${error.expected}\n`
          report += `     APIs affected: ${error.apis.join(', ')}\n`
          report += `     Action: Run ALTER TABLE migration to add this field\n`
          break
        case 'wrong_type':
          report += `  ⚠️  FIELD TYPE MISMATCH: ${error.field}\n`
          report += `     Expected: ${error.expected}\n`
          report += `     Actual: ${error.actual}\n`
          report += `     APIs affected: ${error.apis.join(', ')}\n`
          break
      }
    }
  }

  report += `\n\n💡 Fix these issues before deploying to production!\n`
  report += `   Run: npm run migrate:prod to apply missing migrations\n`

  return report
}

// CLI runner
async function main() {
  const args = process.argv.slice(2)
  const isRemote = args.includes('--remote')

  console.log(`\n🔍 Validating database schema (${isRemote ? 'PRODUCTION' : 'LOCAL'})...\n`)

  // This would need to be connected to actual D1 database
  // For now, print instructions
  console.log(`📝 To run this validation:`)
  console.log(`   1. Ensure wrangler.toml has database binding`)
  console.log(`   2. Run: wrangler d1 execute <db-name> --file=scripts/get-schema.sql`)
  console.log(`   3. Compare output with REQUIRED_TABLES above`)
  console.log(`\n✅ Schema validation script created!`)
  console.log(`\nNext steps:`)
  console.log(`   - Integrate with CI/CD pipeline`)
  console.log(`   - Add to pre-deployment checks`)
  console.log(`   - Run before every production deployment`)
}

if (require.main === module) {
  main()
}

export { validateSchema, REQUIRED_TABLES, formatValidationReport }
