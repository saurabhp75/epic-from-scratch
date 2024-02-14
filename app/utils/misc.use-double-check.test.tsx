/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
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
