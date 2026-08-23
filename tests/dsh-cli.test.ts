import { describe, expect, it } from 'vitest'
import { dshInvocation, isDshProfileName } from '../src/core/dsh-cli.js'

describe('DSH subprocess invocation', () => {
  it('reuses the active DSH launcher even when dsh is not on PATH', () => {
    const launcher = 'F:\\runtime\\node_modules\\@deepseek-ai\\dsh\\lib\\bin.js'
    expect(dshInvocation(['--profile', 'web', '--dump-config'], {
      argv: ['F:\\Node.js\\node.exe', launcher],
      execPath: 'F:\\Node.js\\node.exe',
      platform: 'win32',
    })).toEqual({
      command: 'F:\\Node.js\\node.exe',
      args: [launcher, '--profile', 'web', '--dump-config'],
    })
  })

  it('falls back to the platform command outside a DSH process', () => {
    expect(dshInvocation(['--version'], {
      argv: ['node', 'vitest.js'], execPath: 'node', platform: 'win32',
    })).toEqual({
      command: process.env.ComSpec ?? 'cmd.exe',
      args: ['/d', '/s', '/c', 'dsh.cmd', '--version'],
    })
  })

  it('reuses the official source-checkout launcher', () => {
    const launcher = 'F:\\deepseek-harness\\apps\\cli\\src\\bin.ts'
    expect(dshInvocation(['--profile', 'headless'], {
      argv: ['F:\\Node.js\\node.exe', launcher],
      execPath: 'F:\\Node.js\\node.exe',
      platform: 'win32',
    })).toEqual({
      command: 'F:\\Node.js\\node.exe',
      args: [launcher, '--profile', 'headless'],
    })
  })

  it('accepts only inert profile names', () => {
    expect(isDshProfileName('web-dev_1.2')).toBe(true)
    expect(isDshProfileName('web & whoami')).toBe(false)
    expect(isDshProfileName('../web')).toBe(false)
  })
})
