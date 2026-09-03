import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const readJson = <T>(path: string): T => JSON.parse(readFileSync(resolve(root, path), 'utf8')) as T

interface TypeScriptProject {
  include?: string[]
  exclude?: string[]
}

interface PackageManifest {
  scripts: Record<string, string>
}

test.describe('runtime TypeScript coverage @smoke', () => {
  test('@smoke broad projects include every Pages Function and standalone Worker entry point', () => {
    const functionsConfig = readJson<TypeScriptProject>('tsconfig.functions.json')
    const workersConfig = readJson<TypeScriptProject>('tsconfig.workers.json')
    const containerConfig = readJson<TypeScriptProject>('containers/tsconfig.json')

    expect(functionsConfig.include).toEqual(['functions/**/*.ts'])
    expect(functionsConfig.exclude).toBeUndefined()
    expect(workersConfig.include).toEqual(['workers/**/*.ts'])
    expect(workersConfig.exclude).toBeUndefined()
    expect(containerConfig.include).toEqual(['src/**/*'])
    expect(containerConfig.exclude).toEqual(['node_modules'])
  })

  test('@smoke package and CI contracts execute root, Worker, and isolated Container checks', () => {
    const packageJson = readJson<PackageManifest>('package.json')
    const scripts = packageJson.scripts
    const workflow = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8')

    expect(scripts['type-check']).toContain('type-check:runtimes')
    expect(scripts['type-check:runtimes']).toContain('type-check:functions')
    expect(scripts['type-check:runtimes']).toContain('type-check:workers')
    expect(scripts['type-check:functions']).toContain('tsconfig.functions.json')
    expect(scripts['type-check:workers']).toContain('tsconfig.workers.json')
    expect(scripts['type-check:containers']).toContain('--prefix containers')
    expect(workflow).toContain('- run: npm run type-check')
    expect(workflow).toContain('cache-dependency-path: containers/package-lock.json')
    expect(workflow).toContain('- run: npm run type-check:containers')
    expect(workflow).toContain('needs: [typecheck, container-typecheck]')
  })
})
