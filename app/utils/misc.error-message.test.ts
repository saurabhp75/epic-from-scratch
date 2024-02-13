import { faker } from '@faker-js/faker'
import { expect, test, vi } from 'vitest'
import { getErrorMessage } from './misc'

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

	// Add a vi mock spy on console.error
	const consoleError = vi.spyOn(console, 'error')
	consoleError.mockImplementation(() => {})
	expect(getErrorMessage(undefined)).toBe('Unknown Error')

	// assert that console.error was called with the right arguments
	expect(consoleError).toHaveBeenCalledWith(
		'Unable to get error message for error',
		undefined,
	)

	// make sure console.error was called once
	expect(consoleError).toHaveBeenCalledTimes(1)

	// restore the mock so we don't swallow errors for other tests.
	consoleError.mockRestore()
})
