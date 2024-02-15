/**
 * @vitest-environment jsdom
 */
import { faker } from '@faker-js/faker'
import { createRemixStub } from '@remix-run/testing'
import { render, screen } from '@testing-library/react'
import { AuthenticityTokenProvider } from 'remix-utils/csrf/react'
import setCookieParser from 'set-cookie-parser'
import { test } from 'vitest'
import { getUserImages, insertNewUser } from '@/db-utils'
import { loader as rootLoader } from '~/root'
import { getSessionExpirationDate, sessionKey } from '~/utils/auth.server'
import { prisma } from '~/utils/db.server'
import { invariant } from '~/utils/misc'
import { sessionStorage } from '~/utils/session.server'
import { default as UsernameRoute, loader } from './$username'

test('The user profile when not logged in as self', async () => {
	const user = await insertNewUser()
	const userImages = await getUserImages()
	const userImage =
		userImages[faker.number.int({ min: 0, max: userImages.length - 1 })]
	await prisma.user.update({
		where: { id: user.id },
		data: { image: { create: userImage } },
	})
	// create the stub here
	// it should have a path of /users/:username
	// the element should be <UsernameRoute />
	// the loader should follow the pattern in the instructions
	// return json with the user and a userJoinedDisplay.
	// you can reference the actual loader for an example of what this should
	// look like.
	const App = createRemixStub([
		{
			path: '/users/:username',
			Component: UsernameRoute,
			// replace this fake loader with the real one. That's it for this test!
			loader,
		},
	])

	// render the App instead of the UsernameRoute here
	const routeUrl = `/users/${user.username}`
	await render(<App initialEntries={[routeUrl]} />, {
		// this wrapper is necessary because our UsernameRoute renders the
		// AuthenticityToken and it relies on this provider to render the token.
		wrapper: ({ children }) => (
			<AuthenticityTokenProvider token="test-csrf-token">
				{children}
			</AuthenticityTokenProvider>
		),
	})

	invariant(user.name, 'User name should be defined')

	// you'll notice we're using findBy queries here which are async. We really
	// only need it for the first one, because we need to wait for Remix to update
	// the screen with the UI. Once the first one's there we know the rest of them
	// will be too. But at this level of testing, it's pretty much best to always
	// use the find* variant of queries because you can't always rely on things
	// being synchronously available.
	await screen.findByRole('heading', { level: 1, name: user.name })
	// Create URL playground
	// screen.logTestingPlaygroundURL()
	// Dump the testing DOM
	// screen.debug()
	await screen.findByRole('img', { name: user.name })
	await screen.findByRole('link', { name: `${user.name}'s notes` })
})

test('The user profile when logged in as self', async () => {
	// insert a new user and set them up with an image like in the previous test
	// create a new session for the user
	const user = await insertNewUser()
	const userImages = await getUserImages()
	const userImage =
		userImages[faker.number.int({ min: 0, max: userImages.length - 1 })]
	await prisma.user.update({
		where: { id: user.id },
		data: { image: { create: userImage } },
	})
	const session = await prisma.session.create({
		select: { id: true },
		data: {
			expirationDate: getSessionExpirationDate(),
			userId: user.id,
		},
	})

	const cookieSession = await sessionStorage.getSession()
	cookieSession.set(sessionKey, session.id)
	const setCookieHeader = await sessionStorage.commitSession(cookieSession)
	const parsedCookie = setCookieParser.parseString(setCookieHeader)
	const cookieHeader = new URLSearchParams({
		[parsedCookie.name]: parsedCookie.value,
	}).toString()

	const App = createRemixStub([
		// the root route's path should be "/" and it also needs an id of "root"
		// because our utility for getting the user requires it (check #app/utils/user.ts)
		// for the loader, you can do the same sort of thing we do for the username
		// route loader, just import the type of the rootLoader and use that.
		// the root loader stub will need to return the same properties the real one does
		// but you can fake them out. So you may want to check out the root loader
		{
			id: 'root',
			path: '/',
			// replace this with a smaller one that takes the request, sets the
			// cookie header and then calls the rootLoader directly
			loader: async args => {
				// add the cookie header to the request
				args.request.headers.set('cookie', cookieHeader)
				return rootLoader(args)
			},
			children: [
				{
					// nest this route inside a root route that provides the root loader's data
					// which you'll find in app/root.tsx
					path: 'users/:username',
					Component: UsernameRoute,
					// replace this with a smaller one that takes the request, sets the
					// cookie header and then calls the rootLoader directly
					loader: async args => {
						// add the cookie header to the request
						args.request.headers.set('cookie', cookieHeader)
						return loader(args)
					},
				},
			],
		},
	])

	const routeUrl = `/users/${user.username}`
	await render(<App initialEntries={[routeUrl]} />, {
		wrapper: ({ children }) => (
			<AuthenticityTokenProvider token="test-csrf-token">
				{children}
			</AuthenticityTokenProvider>
		),
	})

	await screen.findByRole('heading', { level: 1, name: user.name })
	await screen.findByRole('img', { name: user.name })
	await screen.findByRole('button', { name: /logout/i })
	await screen.findByRole('link', { name: /my notes/i })
	await screen.findByRole('link', { name: /edit profile/i })
})
