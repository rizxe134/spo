import { spawn } from 'node:child_process'
import { childEnv } from '../runtime-path'
import type { CommandResult, CommandRunner } from './types'

export class ProcessRunner implements CommandRunner {
  async run(file: string, args: string[], opts?: { timeoutMs?: number }): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(file, args, { windowsHide: true, env: childEnv() })
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        child.kill('SIGTERM')
        reject(new Error(`Command timed out: ${file} ${args.join(' ')}`))
      }, opts?.timeoutMs ?? 20_000)

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8')
      })
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })
      child.on('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        resolve({ stdout, stderr, code: code ?? 1 })
      })
    })
  }
}

export class ScriptedRunner implements CommandRunner {
  constructor(private readonly impl: CommandRunner['run']) {}

  run(file: string, args: string[], opts?: { timeoutMs?: number }): Promise<CommandResult> {
    return this.impl(file, args, opts)
  }
}
