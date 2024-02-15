/**
 * @vitest-environment jsdom
 */
import { faker } from '@faker-js/faker'
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ErrorList } from './forms'

// create a test for "shows nothing when given an empty list"
// render the <ErrorList /> with no props
// using queryAllByRole, ensure there are no listitems on the screen
// because queryAllByRole returns an array, you can use the toHaveLength
// utility from vitest to ensure the length is 0

test('shows nothing when given an empty list', async () => {
	// screen.debug()
	// await render(<ErrorList errors={['one']} />)
	await render(<ErrorList />)
	// screen.debug()

	expect(screen.queryAllByRole('listitem')).toHaveLength(0)
})

test('shows a single error', async () => {
	const errors = [faker.lorem.words(3)]
	await render(<ErrorList errors={errors} />)
	const errorEls = screen.getAllByRole('listitem')
	expect(errorEls.map(e => e.textContent)).toEqual(errors)
})

test('shows multiple errors', async () => {
	// add a screen.debug() here to test what things look like before/after
	// you add the cleanup call
	// screen.debug()
	const errors = [faker.lorem.words(3), faker.lorem.words(3)]
	await render(<ErrorList errors={errors} />)
	// Generate playground URL
	// screen.logTestingPlaygroundURL()
	const errorEls = screen.getAllByRole('listitem')
	expect(errorEls.map(e => e.textContent)).toEqual(errors)
})

test('can cope with falsy values', async () => {
	const errors = [
		faker.lorem.words(3),
		null,
		faker.lorem.words(3),
		undefined,
		'',
	]
	await render(<ErrorList errors={errors} />)
	const errorEls = screen.getAllByRole('listitem')
	const actualErrors = errors.filter(Boolean)
	expect(errorEls).toHaveLength(actualErrors.length)
	expect(errorEls.map(e => e.textContent)).toEqual(actualErrors)
})

test('adds id to the ul', async () => {
	const id = faker.lorem.word()
	await render(<ErrorList id={id} errors={[faker.lorem.words(3)]} />)
	const ul = screen.getByRole('list')
	expect(ul).toHaveAttribute('id', id)
})
