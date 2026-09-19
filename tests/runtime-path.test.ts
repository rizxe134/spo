import { describe, expect, it } from 'vitest'
import {
  augmentPath,
  childEnv,
  extraBinDirs,
  pythonCandidates,
  resolvePythonInterpreter
} from '../src/main/runtime-path'

describe('runtime PATH', () => {
  it('prepends macOS GUI-missing bins without dropping the original PATH', () => {
    const next = augmentPath('/usr/bin:/bin', 'darwin', '/Users/demo')
    expect(next.split(':')[0]).toBe('/opt/anaconda3/bin')
    expect(next).toContain('/opt/homebrew/bin')
    expect(next).toContain('/usr/local/bin')
    expect(next.endsWith('/usr/bin:/bin') || next.includes('/usr/bin')).toBe(true)
  })

  it('does not invent mac-only conda paths on linux', () => {
    const dirs = extraBinDirs('linux', '/home/demo')
    expect(dirs).not.toContain('/opt/anaconda3/bin')
    expect(dirs).toEqual(['/usr/local/bin'])
  })

  it('does not rewrite Windows PATH with Unix conda dirs', () => {
    expect(extraBinDirs('win32', 'C:\\Users\\demo')).toEqual([])
  })

  it('copies env and sets PATH for child processes', () => {
    const env = childEnv({ PATH: '/usr/bin', HOME: '/Users/demo' }, 'darwin')
    expect(env.HOME).toBe('/Users/demo')
    expect(env.PATH?.startsWith('/opt/anaconda3/bin:')).toBe(true)
    expect(env.PATH).toContain('/usr/bin')
  })
})

describe('python resolver', () => {
  it('prefers an interpreter that can import pymobiledevice3 over /usr/bin/python3', async () => {
    const exists = (bin: string) =>
      bin === '/usr/bin/python3' || bin === '/opt/anaconda3/bin/python3'
    const probe = async (bin: string) => bin === '/opt/anaconda3/bin/python3'
    const picked = await resolvePythonInterpreter(
      'python3',
      probe,
      exists,
      'darwin',
      '/Users/demo',
      '/usr/bin:/bin'
    )
    expect(picked.python).toBe('/opt/anaconda3/bin/python3')
    expect(picked.probed).toBe(true)
  })

  it('uses an explicit absolute pythonPath first when it has the module', async () => {
    const exists = (bin: string) => bin === '/opt/anaconda3/bin/python3' || bin === '/usr/bin/python3'
    const probe = async (bin: string) => bin === '/opt/anaconda3/bin/python3'
    const picked = await resolvePythonInterpreter(
      '/opt/anaconda3/bin/python3',
      probe,
      exists,
      'darwin',
      '/Users/demo',
      '/usr/bin'
    )
    expect(picked.python).toBe('/opt/anaconda3/bin/python3')
  })

  it('skips an absolute pythonPath that cannot import the sidecar', async () => {
    const exists = (bin: string) =>
      bin === '/usr/bin/python3' || bin === '/opt/anaconda3/bin/python3'
    const probe = async (bin: string) => bin === '/opt/anaconda3/bin/python3'
    const picked = await resolvePythonInterpreter(
      '/usr/bin/python3',
      probe,
      exists,
      'darwin',
      '/Users/demo',
      '/usr/bin'
    )
    expect(picked.python).toBe('/opt/anaconda3/bin/python3')
  })

  it('falls back to an existing python3 when none have the module', async () => {
    const exists = (bin: string) => bin === '/usr/bin/python3'
    const probe = async () => false
    const picked = await resolvePythonInterpreter('python3', probe, exists, 'linux', '/home/demo', '/usr/bin')
    expect(picked.python).toBe('/usr/bin/python3')
    expect(picked.probed).toBe(false)
  })

  it('lists anaconda before system python on macOS', () => {
    const list = pythonCandidates('python3', 'darwin', '/Users/demo', '/usr/bin:/bin')
    expect(list.indexOf('/opt/anaconda3/bin/python3')).toBeLessThan(list.indexOf('/usr/bin/python3'))
  })
})
