import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeUsername, usernameError } from '../src/lib/usernames.ts'

test('usernames are case insensitive and accept an optional cashier @ prefix', () => {
  assert.equal(normalizeUsername(' @Shanice_01 '),'shanice_01')
  assert.equal(usernameError('Shanice_01'),'')
})
test('reserved, malformed, and too long usernames are rejected', () => {
  for(const name of ['ab','123shanice','first last','has-hyphen','admin','ADMIN','ds_000001','x'.repeat(41)]) assert.ok(usernameError(name),name)
})
