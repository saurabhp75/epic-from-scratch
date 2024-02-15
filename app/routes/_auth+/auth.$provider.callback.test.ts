import { generateTOTP } from '@epic-web/totp'
import { faker } from '@faker-js/faker'
import { http } from 'msw'
import * as setCookieParser from 'set-cookie-parser'
// import the mock server from the mocks folder
// because it starts the server for us automatically, you don't have to worry
// about starting it, and it also handles stopping automatically as well.
// import '#tests/mocks/index.ts'
import { afterEach, expect, test } from 'vitest'
import { createUser, insertNewUser, insertedUsers } from '@/db-utils'
import { deleteGitHubUsers, insertGitHubUser } from '@/mocks/github'
import { server } from '@/mocks/index'
import { consoleError } from '@/setup/setup-test-env'
import { getSessionExpirationDate, sessionKey } from '~/utils/auth.server'
import { GITHUB_PROVIDER_NAME } from '~/utils/connections'
import { connectionSessionStorage } from '~/utils/connections.server'
import { prisma } from '~/utils/db.server'
import { invariant } from '~/utils/misc'
import { sessionStorage } from '~/utils/session.server'
import { twoFAVerificationType } from '../settings+/profile.two-factor'
import { loader } from './auth.$provider.callback'

const ROUTE_PATH = '/auth/github/callback'
const PARAMS = { provider: 'github' }
const BASE_URL = 'https://www.epicstack.dev'

// add some cleanup for the github users that are inserted during the tests:
afterEach(async () => {
	await deleteGitHubUsers()
})

// add some cleanup for our own users that are inserted during the tests:
// use insertedUsers from '#tests/db-utils.ts' and make sure to clear it after
// deleting the users.
// if you need a reminder for how we did this in playwright,
// check tests/playwright-utils.ts
afterEach(async () => {
	await prisma.user.deleteMany({
		where: { id: { in: [...insertedUsers] } },
	})
	insertedUsers.clear()
})

test('a new user goes to onboarding', async () => {
	const request = await setupRequest()

	// call the loader with the request, an empty params object, and an empty context object
	const response = await loader({ request, params: PARAMS, context: {} })

	// assert the response is a redirect to `/onboarding/github`
	expect(response.headers.get('location')).toBe('/onboarding/github')
	assertRedirect(response, '/onboarding/github')
})

test('when auth fails, send the user to login with a toast', async () => {
	// in the error case, we call console.error, so you can use the consoleError
	// mock we wrote earlier. It's in '#tests/setup/setup-test-env.ts'. With that,
	// add a mock implementation so we don't throw an error, and then we can assert
	// that it was called once at the end of this test.
	consoleError.mockImplementation(() => {})

	// add a server.use here for a http.post to 'https://github.com/login/oauth/access_token'
	// it should return a response with "error" and a 400 status code
	// you'll find our happy-path mock implementation of this in '#tests/mocks/github.ts' if you're curious
	// this is all the same stuff as the last test:
	server.use(
		http.post('https://github.com/login/oauth/access_token', async () => {
			return new Response('error', { status: 400 })
		}),
	)

	const request = await setupRequest()

	// in the error case, this promise will reject, so you can add a try/catch
	// around it or use .catch to get the response
	const response = await loader({ request, params: PARAMS, context: {} }).catch(
		e => e,
	)
	invariant(response instanceof Response, 'response should be a Response')

	// assert a redirect to '/login'
	assertRedirect(response, '/login')

	// assert a toast was sent (you can use Kellie's assertToastSent util below)
	assertToastSent(response)

	// Assert consoleError was called once and make sure to call mockClear on it.
	expect(consoleError).toHaveBeenCalledTimes(1)
})

test('when a user is logged in, it creates the connection', async () => {
	// create a new github user with insertGitHubUser from '#tests/mocks/github.ts'
	const githubUser = await insertGitHubUser()

	// create a new user (use our insertNewUser util from '#tests/db-utils.ts')
	const session = await setupUser()

	// pass the session.id and githubUser.code to the setupRequest function
	// then go below to handle that
	const request = await setupRequest({
		sessionId: session.id,
		code: githubUser.code,
	})
	const response = await loader({ request, params: PARAMS, context: {} })
	assertRedirect(response, '/settings/profile/connections')
	assertToastSent(response)

	// look in prisma.connection for the connection that should have been
	// created for the user.id + the githubUser.profile.id
	// assert the connection exists
	const connection = await prisma.connection.findFirst({
		select: { id: true },
		where: {
			userId: session.userId,
			providerId: githubUser.profile.id.toString(),
		},
	})

	// console.log(connection);

	expect(
		connection,
		'the connection was not created in the database',
	).toBeTruthy()
})

test(`when a user is logged in and has already connected, it doesn't do anything and just redirects the user back to the connections page`, async () => {
	const session = await setupUser()
	const githubUser = await insertGitHubUser()
	await prisma.connection.create({
		data: {
			providerName: GITHUB_PROVIDER_NAME,
			userId: session.userId,
			providerId: githubUser.profile.id.toString(),
		},
	})
	const request = await setupRequest({
		sessionId: session.id,
		code: githubUser.code,
	})
	const response = await loader({ request, params: PARAMS, context: {} })
	assertRedirect(response, '/settings/profile/connections')
	assertToastSent(response)
})

test('when a user exists with the same email, create connection and make session', async () => {
	const githubUser = await insertGitHubUser()
	const email = githubUser.primaryEmail.toLowerCase()
	const { userId } = await setupUser({ ...createUser(), email })
	const request = await setupRequest({ code: githubUser.code })
	const response = await loader({ request, params: PARAMS, context: {} })

	assertRedirect(response, '/settings/profile/connections')

	assertToastSent(response)

	const connection = await prisma.connection.findFirst({
		select: { id: true },
		where: {
			userId,
			providerId: githubUser.profile.id.toString(),
		},
	})
	expect(
		connection,
		'the connection was not created in the database',
	).toBeTruthy()

	await assertSessionMade(response, userId)
})

test('gives an error if the account is already connected to another user', async () => {
	const githubUser = await insertGitHubUser()
	await prisma.user.create({
		data: {
			...createUser(),
			connections: {
				create: {
					providerName: GITHUB_PROVIDER_NAME,
					providerId: githubUser.profile.id.toString(),
				},
			},
		},
	})
	const session = await setupUser()
	const request = await setupRequest({
		sessionId: session.id,
		code: githubUser.code,
	})
	const response = await loader({ request, params: PARAMS, context: {} })
	assertRedirect(response, '/settings/profile/connections')
	assertToastSent(response)
})

test('if a user is not logged in, but the connection exists, make a session', async () => {
	const githubUser = await insertGitHubUser()
	const { userId } = await setupUser()
	await prisma.connection.create({
		data: {
			providerName: GITHUB_PROVIDER_NAME,
			providerId: githubUser.profile.id.toString(),
			userId,
		},
	})
	const request = await setupRequest({ code: githubUser.code })
	const response = await loader({ request, params: PARAMS, context: {} })
	assertRedirect(response, '/')
	await assertSessionMade(response, userId)
})

test('if a user is not logged in, but the connection exists and they have enabled 2FA, send them to verify their 2FA and do not make a session', async () => {
	const githubUser = await insertGitHubUser()
	const { userId } = await setupUser()
	await prisma.connection.create({
		data: {
			providerName: GITHUB_PROVIDER_NAME,
			providerId: githubUser.profile.id.toString(),
			userId,
		},
	})
	const { otp: _otp, ...config } = generateTOTP()
	await prisma.verification.create({
		data: {
			type: twoFAVerificationType,
			target: userId,
			...config,
		},
	})
	const request = await setupRequest({ code: githubUser.code })
	const response = await loader({ request, params: PARAMS, context: {} })
	const searchParams = new URLSearchParams({
		type: twoFAVerificationType,
		target: userId,
	})
	assertRedirect(response, `/verify?${searchParams}`)
})

function assertToastSent(response: Response) {
	const setCookie = response.headers.get('set-cookie')
	invariant(setCookie, 'set-cookie header should be set')
	const parsedCookie = setCookieParser.splitCookiesString(setCookie)
	expect(parsedCookie).toEqual(
		expect.arrayContaining([expect.stringContaining('en_toast')]),
	)
}

async function assertSessionMade(response: Response, userId: string) {
	// get the set-cookie header from the response
	const setCookie = response.headers.get('set-cookie')
	invariant(setCookie, 'set-cookie header should be set')

	// parse the set-cookie header with setCookieParser.splitCookiesString
	const parsedCookie = setCookieParser.splitCookiesString(setCookie)

	// console.log(parsedCookie)

	// assert that one of the parsed cookies has the 'en_session' in it
	expect(parsedCookie).toEqual(
		expect.arrayContaining([expect.stringContaining('en_session')]),
	)

	// lookup the new session in the database by the userId
	const session = await prisma.session.findFirst({
		select: { id: true },
		where: { userId },
	})

	// assert the session exists
	expect(session).toBeTruthy()
}

// we're going to be asserting redirects a lot, so if you've got extra time
// make a helper function here called assertRedirect that takes a response and
// a redirectTo string. It should assert that the response has a 300 status code
// and that the location header is set to the redirectTo string.
function assertRedirect(response: Response, redirectTo: string) {
	expect(response.status).toBeGreaterThanOrEqual(300)
	expect(response.status).toBeLessThan(400)
	expect(response.headers.get('location')).toBe(redirectTo)
}

function convertSetCookieToCookie(setCookie: string) {
	const parsedCookie = setCookieParser.parseString(setCookie)
	return new URLSearchParams({
		[parsedCookie.name]: parsedCookie.value,
	}).toString()
}

async function setupRequest({
	sessionId,
	code = faker.string.uuid(),
}: { sessionId?: string; code?: string } = {}) {
	// create the URL with the ROUTE_PATH and the BASE_URL
	// tip: new URL('/some/path', 'https://example.com').toString() === 'https://example.com/some/path'
	const url = new URL(ROUTE_PATH, BASE_URL)

	// create the state, faker.string.uuid() should work fine)
	const state = faker.string.uuid()

	// set the url.searchParams for `state` and `code`
	url.searchParams.set('state', state)
	url.searchParams.set('code', code)

	// get the cookie session from the connectionSessionStorage.getSession() function
	const connectionSession = await connectionSessionStorage.getSession()

	// set the 'oauth2:state' value in the cookie session to the `state`
	connectionSession.set('oauth2:state', state)

	// get the cookieSession from sessionStorage (#app/utils/sessions.server.ts)
	// if sessionId exists, then set it in cookieSession under sessionKey property
	const cookieSession = await sessionStorage.getSession()
	if (sessionId) cookieSession.set(sessionKey, sessionId)

	const sessionSetCookieHeader =
		await sessionStorage.commitSession(cookieSession)

	// get a set-cookie header from connectionSessionStorage.commitSession with the cookieSession
	const connectionSetCookieHeader =
		await connectionSessionStorage.commitSession(connectionSession)

	// create a new Request with the url.toString().
	// the method should be GET (since we're calling the loader)
	// the headers should include a cookie, use the convertSetCookieToCookie function below
	const request = new Request(url.toString(), {
		method: 'GET',
		headers: {
			// multiple cookies are joined by the semicolon character,
			// so you'll need to join both cookie values together with a semicolon here:
			cookie: [
				convertSetCookieToCookie(sessionSetCookieHeader),
				convertSetCookieToCookie(connectionSetCookieHeader),
			].join('; '),
		},
	})

	return request
}

async function setupUser(userData = createUser()) {
	const newUser = await insertNewUser(userData)
	const session = await prisma.session.create({
		data: {
			expirationDate: getSessionExpirationDate(),
			user: { connect: newUser },
		},
		select: { id: true, userId: true },
	})

	return session
}
