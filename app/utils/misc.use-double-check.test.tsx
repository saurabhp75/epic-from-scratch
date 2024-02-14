/**
 * @vitest-environment jsdom
 */
import { act, render, renderHook, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test, vi } from 'vitest'
import { useDoubleCheck } from './misc'

test('hook: prevents default on the first click, and does not on the second', async () => {
	// call renderHook here and destructure "result"
	const { result } = await renderHook(() => useDoubleCheck())

	// assert that the doubleCheck value is false
	expect(result.current.doubleCheck).toBe(false)

	// create a mock function with vi.fn()
	const myClick = vi.fn()

	// create a new click event with new MouseEvent
	// if you want TypeScript to be happy, follow the example in the instructions
	// for casting the MouseEvent to React.MouseEvent<HTMLButtonElement>
	const click1 = new MouseEvent('click', {
		bubbles: true,
		cancelable: true,
	}) as unknown as React.MouseEvent<HTMLButtonElement>

	// get the button props from using result.current.getButtonProps and pass
	// your mock function as "onClick"
	// call the onClick prop of the buttonProps with your event
	//  this updates state, so you'll want to wrap this in `act`
	await act(() =>
		result.current.getButtonProps({ onClick: myClick }).onClick(click1),
	)

	expect(result.current.doubleCheck).toBe(true)
	expect(myClick).toHaveBeenCalledWith(click1)
	// assert you˝r mock function was called with the event just once
	expect(myClick).toHaveBeenCalledTimes(1)
	// assert the event.defaultPrevented is true
	expect(click1.defaultPrevented).toBe(true)

	// clear the mock function with mockClear)
	myClick.mockClear()

	// create a second click event with new MouseEvent
	const click2 = new MouseEvent('click', {
		bubbles: true,
		cancelable: true,
	}) as unknown as React.MouseEvent<HTMLButtonElement>

	// get new button props and call the onClick prop with your second event
	//  remember to wrap it in `act`
	await act(() =>
		result.current.getButtonProps({ onClick: myClick }).onClick(click2),
	)

	expect(myClick).toHaveBeenCalledWith(click2)
	// assert your mock function was called with the event just once
	expect(myClick).toHaveBeenCalledTimes(1)
	// assert the event.defaultPrevented is false
	expect(click2.defaultPrevented).toBe(false)
})

// create a test component here. It's up to you how you do it, but it should
// probably render a button that uses the useDoubleCheck hook and renders some
// element that indicates whether the default was prevented or not.
function TestComponent() {
	const [defaultPrevented, setDefaultPrevented] = useState<
		'idle' | 'no' | 'yes'
	>('idle')
	const dc = useDoubleCheck()
	return (
		<div>
			<output>Default Prevented: {defaultPrevented}</output>
			<button
				{...dc.getButtonProps({
					onClick: e => setDefaultPrevented(e.defaultPrevented ? 'yes' : 'no'),
				})}
			>
				{dc.doubleCheck ? 'You sure?' : 'Click me'}
			</button>
		</div>
	)
}

test('TestComponent: prevents default on the first click, and does not on the second', async () => {
	// get the user object from userEvent.setup():
	const user = userEvent.setup()

	// render your test component
	await render(<TestComponent />)

	// verify the initial state of your elements
	const status = screen.getByRole('status')
	const button = screen.getByRole('button')

	expect(status).toHaveTextContent('Default Prevented: idle')
	expect(button).toHaveTextContent('Click me')

	// click on the button
	await user.click(button)

	// verify the state of your elements after the first click
	expect(button).toHaveTextContent('You sure?')
	expect(status).toHaveTextContent('Default Prevented: yes')

	// click on the button again
	await user.click(button)

	// verify the state of your elements after the second click
	expect(button).toHaveTextContent('You sure?')
	expect(status).toHaveTextContent('Default Prevented: no')
})
