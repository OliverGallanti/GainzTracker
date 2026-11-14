import { expect, it } from 'vitest'
import pkg from '../../package.json'
import { APP_VERSION } from './about'

it('shows the version the repo is released as', () => {
  expect(APP_VERSION).toBe(pkg.version)
})
