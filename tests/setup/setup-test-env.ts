import 'dotenv/config'
import 'app/utils/env.server'
import { installGlobals } from '@remix-run/node'
import { cleanup } from '@testing-library/react'
import { beforeEach, vi, type SpyInstance, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { prisma } from '~/utils/db.server'
import { server } from '../mocks/index'
import './custom-matchers'
// eslint-disable-next-line import/order
import { insertedUsers } from '@/db-utils'

installGlobals()

afterEach(() => server.resetHandlers())
afterEach(() => cleanup())

afterEach(async () => {
	await prisma.user.deleteMany({
		where: { id: { in: [...insertedUsers] } },
	})
	insertedUsers.clear()
})


// This should be logged in unit test run
// console.log('Hiiiiiiiii There!!!!!')

// declare a consoleError variable here (using let)
// if you want to make TypeScript happy about this variable, here's the
// typing for that: SpyInstance<Parameters<typeof console.error>>
export let consoleError: SpyInstance<Parameters<typeof console.error>>

// create a beforeEach. It should get the originalConsoleError, then assign
// the consoleError to vi.spyOn...
// Then mock the implementation of consoleError to call the originalConsoleError
// Then throw a new error with a message explaining that console.error was called
// and that you should call consoleError.mockImplementation(() => {}) if you expect
// that to happen.
beforeEach(() => {
	const originalConsoleError = console.error
	consoleError = vi.spyOn(console, 'error')
	consoleError.mockImplementation(
		(...args: Parameters<typeof console.error>) => {
			originalConsoleError(...args)
			throw new Error(
				'Console error was called. Call consoleError.mockImplementation(() => {}) if this is expected.',
			)
		},
	)
})
