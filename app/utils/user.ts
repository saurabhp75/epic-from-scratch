import { useRouteLoaderData } from '@remix-run/react'
import { type loader as rootLoader } from '~/root'

export function useOptionalUser() {
	// because we call useRouteLoaderData with 'root', we're telling Remix we
	// want the loader data from the route that has the ID of 'root'. With our
	// route convention that's assigned to the root route (the one in app/root.tsx)
	// automatically, but in our tests, we need to definte it manually.
	const data = useRouteLoaderData<typeof rootLoader>('root')
	return data?.user ?? null
}

// get the root loader data and
// returns the user if it exists, otherwise return null.

export function useUser() {
	// call useOptionalUser and if the user does not exist, throw
	// an error with an informative error message.
	// Otherwise return the user
	const maybeUser = useOptionalUser()
	if (!maybeUser) {
		throw new Error(
			'No user found in root loader, but user is required by useUser. If user is optional, try useOptionalUser instead.',
		)
	}
	return maybeUser
}
