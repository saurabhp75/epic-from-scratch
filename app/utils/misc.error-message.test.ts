import { faker } from '@faker-js/faker'
import { type SpyInstance, expect, test, vi, beforeEach } from 'vitest'
import { getErrorMessage } from './misc'

// Call these unit test using "npm run test"

// declare a consoleError variable here (using let)
// if you want to make TypeScript happy about this variable, here's the
// typing for that: SpyInstance<Parameters<typeof console.error>>
let consoleError: SpyInstance<Parameters<typeof console.error>>

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

test('Error object returns message', () => {
	const message = faker.lorem.words(2)
	expect(getErrorMessage(new Error(message))).toBe(message)
})

test('String returns itself', () => {
	const message = faker.lorem.words(2)
	expect(getErrorMessage(message)).toBe(message)
})

test('undefined falls back to Unknown', () => {
	// workaround for console.error() shown in error messages
	// console.error = () => {}

	consoleError.mockImplementation(() => {})
	expect(getErrorMessage(undefined)).toBe('Unknown Error')

	// assert that console.error was called with the right arguments
	expect(consoleError).toHaveBeenCalledWith(
		'Unable to get error message for error',
		undefined,
	)

	// make sure console.error was called once
	expect(consoleError).toHaveBeenCalledTimes(1)
})
