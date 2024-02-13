import { faker } from '@faker-js/faker'
import { expect, test } from 'vitest'
import { consoleError } from '@/setup/setup-test-env'
import { getErrorMessage } from './misc'

// Call these unit test using "npm run test"

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
